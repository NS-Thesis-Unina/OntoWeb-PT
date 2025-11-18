import * as cheerio from 'cheerio';
import browser from 'webextension-polyfill';

// ============================================================================
//                           AnalyzerEngine Class
// ============================================================================

/**
 * **AnalyzerEngine**
 *
 * Architectural Role:
 *   React UI
 *     → AnalyzerReactController
 *       → background (AnalyzerBackgroundController)
 *         → **AnalyzerEngine** (this file)
 *           → content_script/analyzer/*
 *
 * Responsibilities:
 *   - Handle **one-time HTML scans** (inject + collect + parse + persist)
 *   - Handle **runtime scans** (continuous scan on page updates)
 *   - Inject analyzer content scripts into tabs
 *   - Parse HTML using cheerio (DOM-like server-side parsing)
 *   - Maintain session helpers (session.lastResult, session.lastByTab)
 *   - Persist results to local storage (one-time + runtime)
 *   - Provide complete archive management API (list/delete/clear)
 *
 * Notes:
 *   - The heavy logic lives here: injection, parsing, dataset aggregation.
 *   - Background controller is a thin router that delegates everything to this engine.
 */
class AnalyzerEngine {
  constructor() {
    // Callback used for one-time scans
    this.resultCallback = null;

    // ---------------- RUNTIME STATE ----------------
    this._runtimeActive = false;
    this._runtimeStartedAt = 0;
    this._runtimeDataset = {}; // { url: [ { meta, results, html } ] }
    this._runtimeTotalScans = 0; // counter
    this._runtimeCallbacks = { onUpdate: null, onComplete: null };
    this._onTabsUpdatedRef = null; // listener reference

    this.initListener();
  }

  // ============================================================================
  //                     Background Listener (content script → engine)
  // ============================================================================

  /**
   * Register listener for messages coming from content scripts.
   *
   * Handles:
   *   - analyzer_scanResult          (one-time)
   *   - analyzer_runtimeScanResult   (runtime)
   */
  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // -----------------------------------------------------------------------
      // ONE-TIME scan results
      // -----------------------------------------------------------------------
      if (message.type === 'analyzer_scanResult' && message.data?.html) {
        const results = this.processHtml(message.data.html);

        const timestamp = Date.now();
        const meta = {
          timestamp,
          tabId: sender?.tab?.id ?? null,
          url: sender?.tab?.url ?? null,
        };
        const html = message.data.html;

        // Persist to local archive
        const key = `analyzerResults_${timestamp}`;
        browser.storage.local.set({ [key]: { meta, results, html } }).catch(() => {});

        // Update session helpers
        this._setSessionValue('analyzer_lastResult', { meta, results, html });
        if (meta.tabId != null) {
          this._updateSessionMap('analyzer_lastByTab', (map) => {
            map[meta.tabId] = { meta, results, html };
            return map;
          });
        }

        // Resolve callback used by runOneTimeScan()
        if (this.resultCallback) {
          const cb = this.resultCallback;
          this.resultCallback = null;
          try {
            cb({ meta, results, html });
          } catch {}
        }

        sendResponse?.({ status: 'ok', received: true });
        return true;
      }

      // -----------------------------------------------------------------------
      // RUNTIME scan results
      // -----------------------------------------------------------------------
      if (message.type === 'analyzer_runtimeScanResult' && message.data?.html) {
        if (!this._runtimeActive) return;

        try {
          const html = message.data.html;
          const tabId = sender?.tab?.id ?? null;
          const url = message.data.url || sender?.tab?.url || null;
          const title = message.data.title || sender?.tab?.title || null;
          const timestamp = message.data.timestamp || Date.now();

          const results = this.processHtml(html);
          const meta = {
            tabId,
            url,
            title: results?.head?.title || title || null,
            timestamp,
            html,
          };

          const key = meta.url || '(unknown_url)';
          if (!this._runtimeDataset[key]) this._runtimeDataset[key] = [];
          this._runtimeDataset[key].push({ meta, results, html });

          this._runtimeTotalScans += 1;

          // Emit incremental update to UI
          this._runtimeCallbacks.onUpdate?.(key, {
            totalScans: this._runtimeTotalScans,
            pagesCount: Object.keys(this._runtimeDataset).length,
            startedAt: this._runtimeStartedAt,
          });
        } catch {}
      }
    });
  }

  // ============================================================================
  //                       Helpers — storage.session
  // ============================================================================

  async _setSessionValue(key, value) {
    try {
      if (browser.storage?.session?.set) {
        await browser.storage.session.set({ [key]: value });
      }
    } catch {}
  }

  async _updateSessionMap(key, mutator) {
    try {
      if (browser.storage?.session?.get && browser.storage?.session?.set) {
        const obj = await browser.storage.session.get(key);
        const map = obj?.[key] ?? {};
        const next = mutator({ ...map });
        await browser.storage.session.set({ [key]: next });
      }
    } catch {}
  }

  // ============================================================================
  //                       ONE-TIME SCAN — injection logic
  // ============================================================================

  _isInjectableUrl(url = '') {
    return /^https?:\/\//i.test(url);
  }

  /**
   * Perform a one-time scan of a tab:
   *   - check URL validity
   *   - inject analyzer_onetime_injected.js
   *   - wait for analyzer_scanResult
   *   - parse HTML + persist
   */
  async runOneTimeScan(tabId, callback) {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    const url = tab?.url || '';

    if (!this._isInjectableUrl(url)) {
      throw new Error(
        'This page does not allow the injection of the content script (unsupported protocol).'
      );
    }

    return new Promise(async (resolve, reject) => {
      let settled = false;

      const finish = (err, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.resultCallback = null;
        if (err) reject(err);
        else resolve(data);
      };

      // Store user callback, executed when scanResult arrives
      const userCb = callback;
      this.resultCallback = (data) => {
        try {
          userCb?.(data);
        } catch {}
        finish(null, data);
      };

      // Inject content script
      try {
        if (browser.scripting) {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ['content_script/analyzer/analyzer_onetime_injected.js'],
          });
        } else {
          await browser.tabs.executeScript(tabId, {
            file: 'content_script/analyzer/analyzer_onetime_injected.js',
          });
        }
      } catch (e) {
        return finish(new Error('Injection failed on this page.'));
      }

      // Timeout fallback
      const timer = setTimeout(() => {
        finish(new Error('Timeout: the page did not respond to the scan.'));
      }, 8000);
    });
  }

  /**
   * List all one-time analyzerResults_* items.
   */
  async getLocalScanResults() {
    try {
      const all = await browser.storage.local.get(null);
      return Object.entries(all)
        .filter(([key]) => key.startsWith('analyzerResults_'))
        .map(([key, value]) => ({ key, results: value }));
    } catch {
      return [];
    }
  }

  // ============================================================================
  //                       RUNTIME SCAN — public API
  // ============================================================================

  /**
   * Begin runtime scan mode:
   *   - clear previous runtime dataset
   *   - inject runtime script into all eligible tabs
   *   - listen for navigation updates
   *   - emit first update
   */
  async startRuntimeScan({ onUpdate, onComplete } = {}) {
    if (this._runtimeActive) return;

    this._runtimeActive = true;
    this._runtimeStartedAt = Date.now();
    this._runtimeDataset = {};
    this._runtimeTotalScans = 0;

    this._runtimeCallbacks = {
      onUpdate: onUpdate || null,
      onComplete: onComplete || null,
    };

    // On navigation, re-inject script
    this._onTabsUpdatedRef = async (tabId, changeInfo, tab) => {
      if (!this._runtimeActive) return;

      const loadingComplete = changeInfo.status === 'complete';
      const injectable = tab?.url && /^https?:/i.test(tab.url);

      if (loadingComplete && injectable) {
        await this._injectRuntimeScript(tabId);
      }
    };

    try {
      browser.tabs.onUpdated.addListener(this._onTabsUpdatedRef);
    } catch {}

    // Inject into all already open tabs
    try {
      const tabs = await browser.tabs.query({});
      for (const t of tabs) {
        if (t?.id && t?.url && /^https?:/i.test(t.url)) {
          await this._injectRuntimeScript(t.id);
        }
      }
    } catch {}

    // First event to UI
    this._runtimeCallbacks.onUpdate?.(null, {
      totalScans: 0,
      pagesCount: 0,
      startedAt: this._runtimeStartedAt,
    });
  }

  /**
   * Stop runtime scan and persist dataset.
   */
  async stopRuntimeScan() {
    if (!this._runtimeActive) {
      return { ok: false, error: 'Runtime not active.' };
    }

    const stoppedAt = Date.now();

    const run = {
      startedAt: this._runtimeStartedAt,
      stoppedAt,
      totalScans: this._runtimeTotalScans,
      pagesCount: Object.keys(this._runtimeDataset).length,
      dataset: this._runtimeDataset,
    };

    const key = `analyzerRuntime_${stoppedAt}`;
    await browser.storage.local.set({ [key]: run, analyzerRuntime_lastKey: key }).catch(() => {});

    // Cleanup listener
    this._runtimeActive = false;
    try {
      this._onTabsUpdatedRef && browser.tabs.onUpdated.removeListener(this._onTabsUpdatedRef);
    } catch {}
    this._onTabsUpdatedRef = null;

    // Emit completion
    this._runtimeCallbacks.onComplete?.({ ok: true, key, run });

    return { ok: true, key, run };
  }

  /**
   * Return minimal runtime status.
   */
  getRuntimeStatus() {
    return {
      runtimeActive: this._runtimeActive,
      startedAt: this._runtimeStartedAt,
      totalScans: this._runtimeTotalScans,
      pagesCount: Object.keys(this._runtimeDataset).length,
    };
  }

  /**
   * Get last saved runtime run.
   */
  async getLastRuntimeResults() {
    const all = await browser.storage.local.get(null);

    // Direct pointer
    let key = all.analyzerRuntime_lastKey || null;

    // Fallback: compute from timestamps
    if (!key) {
      const keys = Object.keys(all).filter(
        (k) => k.startsWith('analyzerRuntime_') && k !== 'analyzerRuntime_lastKey'
      );

      if (keys.length) {
        keys.sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1]));
        key = keys[0];
      }
    }

    return key ? { key, run: all[key] } : { key: null, run: null };
  }

  /**
   * List all runtime runs.
   */
  async getAllRuntimeResults() {
    const all = await browser.storage.local.get(null);

    const items = Object.entries(all)
      .filter(([key]) => {
        if (!key.startsWith('analyzerRuntime_')) return false;
        if (key === 'analyzerRuntime_lastKey') return false;
        const suffix = key.split('_')[1];
        return /^\d+$/.test(suffix);
      })
      .map(([key, run]) => ({ key, run }));

    items.sort((a, b) => Number(b.key.split('_')[1]) - Number(a.key.split('_')[1]));
    return items;
  }

  // ============================================================================
  //                          Runtime Script Injection
  // ============================================================================

  async _injectRuntimeScript(tabId) {
    try {
      if (browser.scripting) {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['content_script/analyzer/analyzer_runtime_injected.js'],
        });
      } else {
        await browser.tabs.executeScript(tabId, {
          file: 'content_script/analyzer/analyzer_runtime_injected.js',
        });
      }
    } catch {}
  }

  // ============================================================================
  //                     ONE-TIME DELETION API
  // ============================================================================

  /**
   * Delete a single one-time analyzer scan by key.
   */
  async deleteOneTimeResultById(resultKey) {
    const key = String(resultKey || '');

    if (!key.startsWith('analyzerResults_')) {
      throw new Error('Invalid analyzer result key.');
    }

    const ts = Number(key.split('_')[1]);
    const targetTimestamp = Number.isFinite(ts) ? ts : null;

    let removedLocal = false;
    let clearedSessionLast = false;
    let clearedSessionTabs = 0;

    // Local storage
    try {
      const existing = await browser.storage.local.get(key);
      if (existing && Object.prototype.hasOwnProperty.call(existing, key)) {
        await browser.storage.local.remove(key);
        removedLocal = true;
      }
    } catch {}

    // Session helpers
    if (browser.storage?.session?.get) {
      try {
        const obj = await browser.storage.session.get([
          'analyzer_lastResult',
          'analyzer_lastByTab',
        ]);

        const last = obj?.analyzer_lastResult ?? null;
        const byTab = obj?.analyzer_lastByTab ?? null;

        // analyzer_lastResult
        if (targetTimestamp != null && last?.meta?.timestamp === targetTimestamp) {
          if (browser.storage.session.remove) {
            await browser.storage.session.remove('analyzer_lastResult');
          } else {
            await browser.storage.session.set({ analyzer_lastResult: null });
          }
          clearedSessionLast = true;
        }

        // analyzer_lastByTab
        if (byTab && typeof byTab === 'object') {
          const next = { ...byTab };
          let changed = false;

          for (const [tid, val] of Object.entries(byTab)) {
            if (val?.meta?.timestamp === targetTimestamp) {
              delete next[tid];
              clearedSessionTabs++;
              changed = true;
            }
          }

          if (changed) {
            await browser.storage.session.set({ analyzer_lastByTab: next });
          }
        }
      } catch {}
    }

    if (!removedLocal && !clearedSessionLast && clearedSessionTabs === 0) {
      throw new Error('Analyzer scan not found in storage.');
    }

    return { removedLocal, clearedSessionLast, clearedSessionTabs };
  }

  /**
   * Delete all one-time analyzer results.
   */
  async clearAllOneTimeResults() {
    let removedKeys = 0;
    let clearedSessionLast = false;
    let clearedSessionTabs = false;

    // Local cleanup
    try {
      const all = await browser.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith('analyzerResults_'));

      if (keys.length > 0) {
        await browser.storage.local.remove(keys);
        removedKeys = keys.length;
      }
    } catch {}

    // Session cleanup
    if (browser.storage?.session?.remove) {
      try {
        await browser.storage.session.remove(['analyzer_lastResult', 'analyzer_lastByTab']);
        clearedSessionLast = true;
        clearedSessionTabs = true;
      } catch {}
    } else if (browser.storage?.session?.set) {
      try {
        await browser.storage.session.set({
          analyzer_lastResult: null,
          analyzer_lastByTab: {},
        });
        clearedSessionLast = true;
        clearedSessionTabs = true;
      } catch {}
    }

    return { removedKeys, clearedSessionLast, clearedSessionTabs };
  }

  // ============================================================================
  //                         RUNTIME DELETION API
  // ============================================================================

  /**
   * Delete a single runtime analyzer run.
   */
  async deleteRuntimeResultById(runtimeKey) {
    const key = String(runtimeKey || '');

    if (!key.startsWith('analyzerRuntime_') || key === 'analyzerRuntime_lastKey') {
      throw new Error('Invalid analyzer runtime key.');
    }

    const suffix = key.split('_')[1];
    if (!/^\d+$/.test(suffix)) {
      throw new Error('Invalid analyzer runtime key format.');
    }

    const all = await browser.storage.local.get(null);

    if (!Object.prototype.hasOwnProperty.call(all, key)) {
      throw new Error('Analyzer runtime scan not found in storage.');
    }

    await browser.storage.local.remove(key);

    const previousLastKey = all.analyzerRuntime_lastKey || null;
    let updatedLastKey = null;
    let removedLastKey = false;
    let lastKeyUnchanged = false;

    if (previousLastKey === key) {
      // Compute new last key
      const remaining = Object.keys(all).filter(
        (k) => k.startsWith('analyzerRuntime_') && k !== 'analyzerRuntime_lastKey' && k !== key
      );

      if (remaining.length > 0) {
        remaining.sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1]));
        updatedLastKey = remaining[0];
        await browser.storage.local.set({ analyzerRuntime_lastKey: updatedLastKey });
      } else {
        // no more runs → remove lastKey
        if (Object.prototype.hasOwnProperty.call(all, 'analyzerRuntime_lastKey')) {
          await browser.storage.local.remove('analyzerRuntime_lastKey');
        }
        removedLastKey = true;
      }
    } else {
      lastKeyUnchanged = previousLastKey != null;
    }

    return {
      removedRuntime: true,
      previousLastKey,
      updatedLastKey,
      removedLastKey,
      lastKeyUnchanged,
    };
  }

  /**
   * Delete all runtime analyzer runs.
   */
  async clearAllRuntimeResults() {
    const all = await browser.storage.local.get(null);

    const keys = Object.keys(all).filter(
      (k) => k.startsWith('analyzerRuntime_') && k !== 'analyzerRuntime_lastKey'
    );

    if (keys.length > 0) {
      await browser.storage.local.remove(keys);
    }

    let hadLastKey = false;

    if (Object.prototype.hasOwnProperty.call(all, 'analyzerRuntime_lastKey')) {
      hadLastKey = true;
      await browser.storage.local.remove('analyzerRuntime_lastKey');
    }

    return {
      removedRuntimeKeys: keys.length,
      hadLastKey,
    };
  }

  // ============================================================================
  //                     HTML PARSER (Cheerio DOM extraction)
  // ============================================================================

  /**
   * Extracts metadata, head/body elements, attributes, lists, forms,
   * images, headings, stats etc.
   *
   * Highly normalized: trims whitespace, removes dashes, ignores empty entries.
   */
  processHtml(html) {
    const $ = cheerio.load(html);

    const norm = (s) =>
      String(s ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const isDashOnly = (s) => /^[-–—•]+$/.test(s);
    const isMeaningfulText = (s) => {
      const t = norm(s);
      return t.length > 0 && !isDashOnly(t);
    };

    const nonEmpty = (v) => v != null && norm(v) !== '';
    const ensureArray = (arr) => (Array.isArray(arr) ? arr : []);
    const filterMap = (arr, mapFn, keepFn = Boolean) => ensureArray(arr).map(mapFn).filter(keepFn);

    function getDepth(node, depth = 0) {
      const children = $(node).children();
      if (children.length === 0) return depth;
      return Math.max(...children.map((_, child) => getDepth(child, depth + 1)).get());
    }

    // ---------------- HEAD ----------------
    const headTitle = (() => {
      const t = norm($('title').text());
      return t || null;
    })();

    const headMeta = filterMap(
      $('meta').get(),
      (el) => {
        const name = norm($(el).attr('name') || $(el).attr('property') || '');
        const content = norm($(el).attr('content') || '');
        return { name: name || null, content: content || null };
      },
      (m) => nonEmpty(m.name) || nonEmpty(m.content)
    );

    const headLinks = filterMap(
      $('head link').get(),
      (el) => {
        const rel = norm($(el).attr('rel') || '');
        const href = norm($(el).attr('href') || '');
        return { rel: rel || null, href: href || null };
      },
      (l) => nonEmpty(l.rel) || nonEmpty(l.href)
    );

    const headScripts = filterMap(
      $('head script').get(),
      (el) => {
        const src = norm($(el).attr('src') || '');
        const inlineRaw = $(el).html() ?? '';
        const inline = norm(inlineRaw);
        return {
          src: src || null,
          inline: inline || null,
        };
      },
      (s) => nonEmpty(s.src) || nonEmpty(s.inline)
    );

    // ---------------- BODY: HEADINGS ----------------
    const headings = {
      h1: filterMap($('h1').get(), (el) => norm($(el).text() || ''), isMeaningfulText),
      h2: filterMap($('h2').get(), (el) => norm($(el).text() || ''), isMeaningfulText),
      h3: filterMap($('h3').get(), (el) => norm($(el).text() || ''), isMeaningfulText),
      h4: filterMap($('h4').get(), (el) => norm($(el).text() || ''), isMeaningfulText),
      h5: filterMap($('h5').get(), (el) => norm($(el).text() || ''), isMeaningfulText),
      h6: filterMap($('h6').get(), (el) => norm($(el).text() || ''), isMeaningfulText),
    };

    // ---------------- BODY: LINKS ----------------
    const bodyLinks = filterMap(
      $('a').get(),
      (el) => ({
        href: norm($(el).attr('href') || ''),
        text: norm($(el).text() || ''),
      }),
      (l) => nonEmpty(l.href) || isMeaningfulText(l.text)
    );

    // ---------------- BODY: FORMS ----------------
    const bodyForms = filterMap(
      $('form').get(),
      (form) => {
        const action = norm($(form).attr('action') || '');
        const method = norm($(form).attr('method') || 'GET');

        const inputs = filterMap(
          $(form).find('input, select, textarea, button').get(),
          (el) => ({
            tag: (el.tagName || '').toLowerCase() || null,
            name: norm($(el).attr('name') || '') || null,
            type: norm($(el).attr('type') || (el.tagName || '').toLowerCase()) || null,
            value: norm($(el).attr('value') || '') || null,
            placeholder: norm($(el).attr('placeholder') || '') || null,
          }),
          (i) => nonEmpty(i.name) || nonEmpty(i.value) || nonEmpty(i.placeholder)
        );

        const keep = nonEmpty(action) || nonEmpty(method) || inputs.length > 0;
        return keep ? { action: action || null, method: method || null, inputs } : null;
      },
      Boolean
    );

    // ---------------- BODY: MEDIA ----------------
    const bodyImages = filterMap(
      $('img').get(),
      (el) => {
        const src = norm($(el).attr('src') || '');
        const alt = norm($(el).attr('alt') || '');
        return { src: src || null, alt };
      },
      (img) => nonEmpty(img.src)
    );

    const bodyVideos = filterMap(
      $('video').get(),
      (el) => {
        const src = norm($(el).attr('src') || '');
        const controls = $(el).attr('controls') !== undefined;
        return { src: src || null, controls: Boolean(controls) };
      },
      (v) => nonEmpty(v.src) || v.controls
    );

    const bodyAudios = filterMap(
      $('audio').get(),
      (el) => {
        const src = norm($(el).attr('src') || '');
        const controls = $(el).attr('controls') !== undefined;
        return { src: src || null, controls: Boolean(controls) };
      },
      (a) => nonEmpty(a.src) || a.controls
    );

    const bodyIframes = filterMap(
      $('iframe').get(),
      (el) => {
        const src = norm($(el).attr('src') || '');
        const title = norm($(el).attr('title') || '');
        return { src: src || null, title: title || null };
      },
      (f) => nonEmpty(f.src) || nonEmpty(f.title)
    );

    // ---------------- BODY: LISTS ----------------
    const bodyLists = filterMap(
      $('ul, ol').get(),
      (el) => {
        const type = (el.tagName || '').toLowerCase();

        const items = filterMap(
          $(el).find('li').get(),
          (li) => norm($(li).text() || ''),
          isMeaningfulText
        );

        return items.length ? { type, items } : null;
      },
      Boolean
    );

    // ---------------- STATS ----------------
    const stats = {
      totalElements: $('*').length,
      depth: getDepth('html', 0),
      tagCount: $('*')
        .map((i, el) => el.tagName)
        .get()
        .reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {}),
    };

    // ---------------- RESULT ----------------
    return {
      head: {
        title: headTitle,
        meta: headMeta,
        links: headLinks,
        scripts: headScripts,
      },
      body: {
        headings,
        links: bodyLinks,
        forms: bodyForms,
        images: bodyImages,
        videos: bodyVideos,
        audios: bodyAudios,
        iframes: bodyIframes,
        lists: bodyLists,
      },
      stats,
    };
  }
}

export default AnalyzerEngine;

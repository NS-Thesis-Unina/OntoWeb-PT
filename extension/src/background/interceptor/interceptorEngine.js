import browser from 'webextension-polyfill';
import { DeepCaptureChrome, isChromeLike } from './deepCaptureChrome.js';
import { DeepCaptureFirefox, isFirefoxLike } from './deepCaptureFirefox.js';

// ============================================================================
//                          Constants / Storage Keys
// ============================================================================

const MAX_BODY_BYTES_DEFAULT = 1024 * 1024; // 1 MB
const DATASET_KEY_PREFIX = 'interceptorRun_';
const LAST_KEY = 'interceptorRun_lastKey';
const FLAGS_KEY = 'interceptor_flags';

// ============================================================================
//                          InterceptorEngine Class
// ============================================================================

/**
 * **InterceptorEngine**
 *
 * Architectural Role:
 *   React UI
 *     → InterceptorReactController
 *       → background (InterceptorBackgroundController)
 *         → **InterceptorEngine** (this file)
 *           → Deep-Capture (Chrome/Firefox)
 *           → content_script (runtime HTTP/Beacon/SSE/WebSocket collector)
 *
 * Responsibilities:
 *   - Start/stop deep network capture sessions
 *   - Inject interceptor content script into active tabs
 *   - Capture HTTP(S) traffic via:
 *       • fetch/XHR hooks (content script)
 *       • chrome.debugger (Chrome deep capture)
 *       • devtools API fallback (Firefox deep capture)
 *   - Aggregate dataset per page URL
 *   - Maintain totals (events, bytes, pages)
 *   - Emit live incremental updates
 *   - Persist completed runs to local storage
 *   - Expose full archive management API (list, delete, clear)
 *
 * Notes:
 *   - This engine performs **heavy runtime capture**.
 *   - No UI or Chrome API must depend on this file directly.
 *   - Background controller routes all requests here.
 */
class InterceptorEngine {
  constructor() {
    // Capture session state
    this._active = false;
    this._startedAt = 0;

    // Dataset structure:
    //   { pageUrl: [ entries... ] }
    this._dataset = {};

    // Totals
    this._totalEvents = 0;
    this._totalBytes = 0;

    // UI notification callbacks
    this._callbacks = { onUpdate: null, onComplete: null };

    // Chrome/Firefox deep capture implementations
    this._deepChrome = null;
    this._deepFirefox = null;

    // Tab update listener reference
    this._onTabsUpdatedRef = null;
    this._navListenerAdded = false;

    // Default flags (only HTTP enabled)
    this._flags = {
      types: { http: true, beacon: false, sse: false, websocket: false },
      maxBodyBytes: MAX_BODY_BYTES_DEFAULT,
    };
  }

  // ============================================================================
  //                          Capture Session: Start
  // ============================================================================

  async start({ config, onUpdate, onComplete } = {}) {
    if (this._active) return;

    this._active = true;
    this._startedAt = Date.now();
    this._dataset = {};
    this._totalEvents = 0;
    this._totalBytes = 0;

    this._callbacks = {
      onUpdate: onUpdate || null,
      onComplete: onComplete || null,
    };

    // ----------------------------- Flags -----------------------------
    const cfg = config || {};

    const types = {
      http: true,
      beacon: false,
      sse: false,
      websocket: false,
      ...(cfg.types || {}),
    };

    const maxBodyBytes =
      Number(cfg.maxBodyBytes) > 0 ? Number(cfg.maxBodyBytes) : MAX_BODY_BYTES_DEFAULT;

    this._flags = { types, maxBodyBytes };

    // Persist flags for content script
    try {
      await browser.storage.local.set({ [FLAGS_KEY]: this._flags });
    } catch {}

    // ============================================================================
    //                          Deep-Capture (Chrome)
    // ============================================================================

    if (types.http && isChromeLike) {
      try {
        this._deepChrome = new DeepCaptureChrome((entry, tabId, pageUrl) => {
          this._ingestDirect(entry, pageUrl || entry?.meta?.pageUrl || null);
        });

        // Attach deep capture to all active tabs
        const tabs = await browser.tabs.query({});
        for (const t of tabs) {
          if (t?.id && t?.url && /^https?:/i.test(t.url)) {
            try {
              await this._deepChrome.attachToTab(t.id);
            } catch {}
          }
        }
      } catch {
        this._deepChrome = null;
      }
    }

    // ============================================================================
    //                          Deep-Capture (Firefox)
    // ============================================================================

    if (types.http && isFirefoxLike) {
      try {
        this._deepFirefox = new DeepCaptureFirefox((entry, tabId, pageUrl) => {
          this._ingestDirect(entry, pageUrl || entry?.meta?.pageUrl || null);
        });
      } catch {
        this._deepFirefox = null;
      }
    }

    // ============================================================================
    //              Auto-attach deep capture on browser navigation
    // ============================================================================

    try {
      if (types.http && !this._navListenerAdded && chrome?.webNavigation?.onCommitted) {
        chrome.webNavigation.onCommitted.addListener(({ tabId, url, frameId }) => {
          if (!this._active) return;
          if (frameId === 0 && /^https?:/i.test(url)) {
            if (this._deepChrome) {
              try {
                this._deepChrome.attachToTab(tabId);
              } catch {}
            }
          }
        });

        this._navListenerAdded = true;
      }
    } catch {}

    // ============================================================================
    //                    Injection fallback + onUpdated events
    // ============================================================================

    this._onTabsUpdatedRef = async (tabId, changeInfo, tab) => {
      if (!this._active) return;

      const shouldInject =
        (changeInfo.status === 'loading' || changeInfo.status === 'complete') &&
        tab?.url &&
        /^https?:/i.test(tab.url);

      if (shouldInject) {
        await this._inject(tabId);

        if (types.http && this._deepChrome) {
          try {
            await this._deepChrome.attachToTab(tabId);
          } catch {}
        }
      }
    };

    try {
      browser.tabs.onUpdated.addListener(this._onTabsUpdatedRef);
    } catch {}

    // Inject into all already-open tabs
    try {
      const existingTabs = await browser.tabs.query({});
      for (const t of existingTabs) {
        if (t?.id && t?.url && /^https?:/i.test(t.url)) {
          await this._inject(t.id);
          if (types.http && this._deepChrome) {
            try {
              await this._deepChrome.attachToTab(t.id);
            } catch {}
          }
        }
      }
    } catch {}

    // Initial update
    this._emitUpdate();
  }

  // ============================================================================
  //                          Capture Session: Stop
  // ============================================================================

  async stop() {
    if (!this._active) {
      return { ok: false, error: 'Interceptor not active.' };
    }

    const stoppedAt = Date.now();

    // Build run structure
    const run = {
      startedAt: this._startedAt,
      stoppedAt,
      totalEvents: this._totalEvents,
      pagesCount: Object.keys(this._dataset).length,
      totalBytes: this._totalBytes,
      dataset: this._dataset,
    };

    const key = `${DATASET_KEY_PREFIX}${stoppedAt}`;

    // Persist run + lastKey pointer
    await browser.storage.local.set({ [key]: run, [LAST_KEY]: key }).catch(() => {});

    // Mark inactive before cleanup
    this._active = false;

    // Remove listeners
    try {
      if (this._onTabsUpdatedRef) {
        browser.tabs.onUpdated.removeListener(this._onTabsUpdatedRef);
      }
    } catch {}

    this._onTabsUpdatedRef = null;

    try {
      if (this._deepChrome) await this._deepChrome.detachFromAll();
    } catch {}
    try {
      if (this._deepFirefox) await this._deepFirefox.destroy?.();
    } catch {}

    this._deepChrome = null;
    this._deepFirefox = null;

    // Notify UI (background → React)
    this._callbacks.onComplete?.({
      ok: true,
      key,
      run: this._stripDataset(run),
    });

    return {
      ok: true,
      key,
      run: this._stripDataset(run),
    };
  }

  // ============================================================================
  //                          Status API
  // ============================================================================

  getStatus() {
    return {
      active: this._active,
      startedAt: this._startedAt,
      totalEvents: this._totalEvents,
      pagesCount: Object.keys(this._dataset).length,
      totalBytes: this._totalBytes,
    };
  }

  // ============================================================================
  //                      Archive Retrieval (Local Storage)
  // ============================================================================

  async getLastResults() {
    const all = await browser.storage.local.get(null);

    let key = all[LAST_KEY] || null;

    // If missing pointer, derive newest run
    if (!key) {
      const keys = Object.keys(all).filter((k) => k.startsWith(DATASET_KEY_PREFIX));

      if (keys.length) {
        keys.sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1]));
        key = keys[0];
      }
    }

    const run = key ? all[key] : null;
    return key ? { key, run } : { key: null, run: null };
  }

  async getAllResultsMeta() {
    const all = await browser.storage.local.get(null);

    const items = Object.entries(all)
      .filter(([key]) => key.startsWith(DATASET_KEY_PREFIX))
      .map(([key, run]) => ({
        key,
        meta: this._stripDataset(run),
      }));

    items.sort((a, b) => Number(b.key.split('_')[1]) - Number(a.key.split('_')[1]));

    return items;
  }

  // ============================================================================
  //                     Runtime Ingestion (content script)
  // ============================================================================

  ingestCapture(payload, sender) {
    if (!this._active || !payload) return;

    try {
      const pageUrl = payload.pageUrl || sender?.tab?.url || '(unknown_page)';
      const ts = payload.ts || Date.now();

      const entry = {
        meta: {
          ts,
          tabId: sender?.tab?.id ?? null,
          pageUrl,
        },
        request: payload.request || null,
        response: payload.response || null,
      };

      this._ingestDirect(entry, pageUrl);
    } catch {}
  }

  // ============================================================================
  //                 Central ingestion routine (deep + content script)
  // ============================================================================

  _ingestDirect(entry, pageUrl) {
    try {
      const url = pageUrl || entry?.meta?.pageUrl || '(unknown_page)';

      if (!this._dataset[url]) this._dataset[url] = [];
      this._dataset[url].push(entry);

      // Totals
      this._totalEvents += 1;

      const reqSize = entry?.request?.bodySize || 0;
      const resSize = entry?.response?.bodySize || 0;

      this._totalBytes += reqSize + resSize;

      this._emitUpdate();
    } catch {}
  }

  // ============================================================================
  //                               Injection
  // ============================================================================

  async _inject(tabId) {
    try {
      if (browser.scripting?.executeScript) {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['content_script/interceptor/interceptor_injected.js'],
        });
      } else {
        await browser.tabs.executeScript(tabId, {
          file: 'content_script/interceptor/interceptor_injected.js',
        });
      }
    } catch {}
  }

  // ============================================================================
  //                         Event Emitters → UI
  // ============================================================================

  _emitUpdate() {
    this._callbacks.onUpdate?.({
      startedAt: this._startedAt,
      totalEvents: this._totalEvents,
      pagesCount: Object.keys(this._dataset).length,
      totalBytes: this._totalBytes,
    });
  }

  _stripDataset(run) {
    return {
      startedAt: run.startedAt,
      stoppedAt: run.stoppedAt,
      totalEvents: run.totalEvents,
      pagesCount: run.pagesCount,
      totalBytes: run.totalBytes,
    };
  }

  // ============================================================================
  //                        Deletion API (archive cleanup)
  // ============================================================================

  async deleteRunById(runKey) {
    const key = String(runKey || '');

    if (!key.startsWith(DATASET_KEY_PREFIX) || key === LAST_KEY) {
      throw new Error('Invalid interceptor run key.');
    }

    const suffix = key.split('_')[1];
    if (!/^\d+$/.test(suffix)) {
      throw new Error('Invalid interceptor run key format.');
    }

    const all = await browser.storage.local.get(null);

    if (!Object.prototype.hasOwnProperty.call(all, key)) {
      throw new Error('Interceptor run not found in storage.');
    }

    // Remove this run
    await browser.storage.local.remove(key);

    const previousLastKey = all[LAST_KEY] || null;

    let updatedLastKey = null;
    let removedLastKey = false;
    let lastKeyUnchanged = false;

    if (previousLastKey === key) {
      // Deleted the "last" one → recompute last key
      const remaining = Object.keys(all).filter(
        (k) => k.startsWith(DATASET_KEY_PREFIX) && k !== LAST_KEY && k !== key
      );

      if (remaining.length > 0) {
        remaining.sort((a, b) => Number(b.split('_')[1]) - Number(a.split('_')[1]));
        const newLast = remaining[0];
        await browser.storage.local.set({ [LAST_KEY]: newLast });
        updatedLastKey = newLast;
      } else {
        // No runs left → remove pointer
        if (Object.prototype.hasOwnProperty.call(all, LAST_KEY)) {
          await browser.storage.local.remove(LAST_KEY);
        }
        removedLastKey = true;
      }
    } else {
      // Deleted run is not last → pointer remains valid
      lastKeyUnchanged = previousLastKey != null;
    }

    return {
      removedRun: true,
      previousLastKey,
      updatedLastKey,
      removedLastKey,
      lastKeyUnchanged,
    };
  }

  async clearAllRuns() {
    const all = await browser.storage.local.get(null);

    const runKeys = Object.keys(all).filter(
      (k) => k.startsWith(DATASET_KEY_PREFIX) && k !== LAST_KEY
    );

    if (runKeys.length > 0) {
      await browser.storage.local.remove(runKeys);
    }

    let hadLastKey = false;

    if (Object.prototype.hasOwnProperty.call(all, LAST_KEY)) {
      hadLastKey = true;
      await browser.storage.local.remove(LAST_KEY);
    }

    return {
      removedRunKeys: runKeys.length,
      hadLastKey,
    };
  }
}

export default InterceptorEngine;
export { MAX_BODY_BYTES_DEFAULT as MAX_BODY_BYTES, DATASET_KEY_PREFIX, LAST_KEY, FLAGS_KEY };

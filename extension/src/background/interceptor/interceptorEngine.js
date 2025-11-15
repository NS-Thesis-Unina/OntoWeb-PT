import browser from "webextension-polyfill";
import { DeepCaptureChrome, isChromeLike } from "./deepCaptureChrome.js";
import { DeepCaptureFirefox, isFirefoxLike } from "./deepCaptureFirefox.js";

const MAX_BODY_BYTES_DEFAULT = 1024 * 1024;
const DATASET_KEY_PREFIX = "interceptorRun_";
const LAST_KEY = "interceptorRun_lastKey";
const FLAGS_KEY = "interceptor_flags";

class InterceptorEngine {
  constructor() {
    this._active = false;
    this._startedAt = 0;
    this._dataset = {};
    this._totalEvents = 0;
    this._totalBytes = 0;
    this._callbacks = { onUpdate: null, onComplete: null };
    this._onTabsUpdatedRef = null;

    this._deepChrome = null;
    this._deepFirefox = null;
    this._navListenerAdded = false;

    // Safe defaults: only HTTP enabled
    this._flags = {
      types: { http: true, beacon: false, sse: false, websocket: false },
      maxBodyBytes: MAX_BODY_BYTES_DEFAULT
    };
  }

  async start({ config, onUpdate, onComplete } = {}) {
    if (this._active) return;
    this._active = true;
    this._startedAt = Date.now();
    this._dataset = {};
    this._totalEvents = 0;
    this._totalBytes = 0;
    this._callbacks = { onUpdate: onUpdate || null, onComplete: onComplete || null };

    const cfg = config || {};
    const types = {
      http: true,
      beacon: false,
      sse: false,
      websocket: false,
      ...(cfg.types || {})
    };
    const maxBodyBytes = Number(cfg.maxBodyBytes) > 0 ? Number(cfg.maxBodyBytes) : MAX_BODY_BYTES_DEFAULT;
    this._flags = { types, maxBodyBytes };

    // Persist flags for the content script
    try { await browser.storage.local.set({ [FLAGS_KEY]: this._flags }); } catch {}

    // Deep-capture only if HTTP is enabled
    if (types.http && isChromeLike) {
      try {
        this._deepChrome = new DeepCaptureChrome((entry, tabId, pageUrl) => {
          this._ingestDirect(entry, pageUrl || entry?.meta?.pageUrl || null);
        });
        const tabs = await browser.tabs.query({});
        for (const t of tabs) {
          if (t?.id && t?.url && /^https?:/i.test(t.url)) {
            try { await this._deepChrome.attachToTab(t.id); } catch {}
          }
        }
      } catch { this._deepChrome = null; }
    }

    if (types.http && isFirefoxLike) {
      try {
        this._deepFirefox = new DeepCaptureFirefox((entry, tabId, pageUrl) => {
          this._ingestDirect(entry, pageUrl || entry?.meta?.pageUrl || null);
        });
      } catch { this._deepFirefox = null; }
    }

    // Auto-attach on navigations for HTTP
    try {
      if (types.http && !this._navListenerAdded && chrome?.webNavigation?.onCommitted) {
        chrome.webNavigation.onCommitted.addListener(({ tabId, url, frameId }) => {
          if (!this._active) return;
          if (frameId === 0 && /^https?:/i.test(url)) {
            if (this._deepChrome) { try { this._deepChrome.attachToTab(tabId); } catch {} }
          }
        });
        this._navListenerAdded = true;
      }
    } catch {}

    // Fallback injection + tab updates
    this._onTabsUpdatedRef = async (tabId, changeInfo, tab) => {
      if (!this._active) return;
      if ((changeInfo.status === "loading" || changeInfo.status === "complete") && tab?.url && /^https?:/i.test(tab.url)) {
        await this._inject(tabId);
        if (types.http && this._deepChrome) { try { await this._deepChrome.attachToTab(tabId); } catch {} }
      }
    };
    try { browser.tabs.onUpdated.addListener(this._onTabsUpdatedRef); } catch {}

    try {
      const existingTabs = await browser.tabs.query({});
      for (const t of existingTabs) {
        if (t?.id && t?.url && /^https?:/i.test(t.url)) {
          await this._inject(t.id);
          if (types.http && this._deepChrome) { try { await this._deepChrome.attachToTab(t.id); } catch {} }
        }
      }
    } catch {}

    this._emitUpdate();
  }

  async stop() {
    if (!this._active) return { ok: false, error: "Interceptor not active." };

    const stoppedAt = Date.now();
    const run = {
      startedAt: this._startedAt,
      stoppedAt,
      totalEvents: this._totalEvents,
      pagesCount: Object.keys(this._dataset).length,
      totalBytes: this._totalBytes,
      dataset: this._dataset
    };

    const key = `${DATASET_KEY_PREFIX}${stoppedAt}`;
    await browser.storage.local.set({ [key]: run, [LAST_KEY]: key }).catch(() => {});

    this._active = false;
    try { this._onTabsUpdatedRef && browser.tabs.onUpdated.removeListener(this._onTabsUpdatedRef); } catch {}
    this._onTabsUpdatedRef = null;

    try { if (this._deepChrome) await this._deepChrome.detachFromAll(); } catch {}
    try { if (this._deepFirefox) await this._deepFirefox.destroy?.(); } catch {}
    this._deepChrome = null;
    this._deepFirefox = null;

    this._callbacks.onComplete?.({ ok: true, key, run: this._stripDataset(run) });
    return { ok: true, key, run: this._stripDataset(run) };
  }

  getStatus() {
    return {
      active: this._active,
      startedAt: this._startedAt,
      totalEvents: this._totalEvents,
      pagesCount: Object.keys(this._dataset).length,
      totalBytes: this._totalBytes
    };
  }

  async getLastResults() {
    const all = await browser.storage.local.get(null);
    let key = all[LAST_KEY] || null;
    if (!key) {
      const keys = Object.keys(all).filter(k => k.startsWith(DATASET_KEY_PREFIX));
      if (keys.length) {
        keys.sort((a, b) => Number(b.split("_")[1]) - Number(a.split("_")[1]));
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
      .map(([key, run]) => ({ key, meta: this._stripDataset(run) }));
    items.sort((a, b) => Number(b.key.split("_")[1]) - Number(a.key.split("_")[1]));
    return items;
  }

  ingestCapture(payload, sender) {
    if (!this._active || !payload) return;
    try {
      const pageUrl = payload.pageUrl || sender?.tab?.url || "(unknown_page)";
      const tabId = sender?.tab?.id ?? null;
      const meta = { ts: payload?.ts || Date.now(), tabId, pageUrl };
      const entry = { meta, request: payload.request || null, response: payload.response || null };
      this._ingestDirect(entry, pageUrl);
    } catch {}
  }

  _ingestDirect(entry, overridePageUrl) {
    try {
      const pageUrl = overridePageUrl || (entry?.meta?.pageUrl) || "(unknown_page)";
      if (!this._dataset[pageUrl]) this._dataset[pageUrl] = [];
      this._dataset[pageUrl].push(entry);

      this._totalEvents += 1;
      const reqSize = entry?.request?.bodySize || 0;
      const resSize = entry?.response?.bodySize || 0;
      this._totalBytes += (reqSize + resSize);

      this._emitUpdate();
    } catch {}
  }

  async _inject(tabId) {
    try {
      if (browser.scripting?.executeScript) {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ["content_script/interceptor/interceptor_injected.js"]
        });
      } else {
        await browser.tabs.executeScript(tabId, { file: "content_script/interceptor/interceptor_injected.js" });
      }
    } catch {}
  }

  _emitUpdate() {
    this._callbacks.onUpdate?.({
      startedAt: this._startedAt,
      totalEvents: this._totalEvents,
      pagesCount: Object.keys(this._dataset).length,
      totalBytes: this._totalBytes
    });
  }

  _stripDataset(run) {
    return {
      startedAt: run.startedAt,
      stoppedAt: run.stoppedAt,
      totalEvents: run.totalEvents,
      pagesCount: run.pagesCount,
      totalBytes: run.totalBytes
    };
  }

  // ---------- Deletion helpers ----------

  /**
   * Delete a single interceptor run by key (interceptorRun_<timestamp>).
   * Updates interceptorRun_lastKey if needed; removes it when no runs remain.
   */
  async deleteRunById(runKey) {
    const key = String(runKey || "");

    if (!key.startsWith(DATASET_KEY_PREFIX) || key === LAST_KEY) {
      throw new Error("Invalid interceptor run key.");
    }

    const suffix = key.split("_")[1];
    if (!/^\d+$/.test(suffix)) {
      throw new Error("Invalid interceptor run key format.");
    }

    const all = await browser.storage.local.get(null);

    if (!Object.prototype.hasOwnProperty.call(all, key)) {
      throw new Error("Interceptor run not found in storage.");
    }

    // Remove the specific run
    await browser.storage.local.remove(key);

    const previousLastKey = all[LAST_KEY] || null;
    let updatedLastKey = null;
    let removedLastKey = false;
    let lastKeyUnchanged = false;

    if (previousLastKey === key) {
      // Deleted run was the last key → compute new last key
      const remainingKeys = Object.keys(all).filter((k) =>
        k.startsWith(DATASET_KEY_PREFIX) &&
        k !== LAST_KEY &&
        k !== key
      );

      if (remainingKeys.length > 0) {
        remainingKeys.sort(
          (a, b) => Number(b.split("_")[1]) - Number(a.split("_")[1])
        );
        const newLast = remainingKeys[0];
        await browser.storage.local.set({ [LAST_KEY]: newLast });
        updatedLastKey = newLast;
      } else {
        // No remaining runs → remove LAST_KEY
        if (Object.prototype.hasOwnProperty.call(all, LAST_KEY)) {
          await browser.storage.local.remove(LAST_KEY);
        }
        removedLastKey = true;
      }
    } else {
      // Deleted run is not the last key → lastKey stays unchanged
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

  /**
   * Delete all interceptor runs from local storage (including interceptorRun_lastKey).
   */
  async clearAllRuns() {
    const all = await browser.storage.local.get(null);

    const runKeys = Object.keys(all).filter((k) =>
      k.startsWith(DATASET_KEY_PREFIX) &&
      k !== LAST_KEY
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

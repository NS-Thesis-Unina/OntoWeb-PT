import * as cheerio from "cheerio";
import browser from "webextension-polyfill";

class AnalyzerEngine {
  constructor() {
    this.resultCallback = null;

    // ---- Stato RUNTIME ----
    this._runtimeActive = false;
    this._runtimeStartedAt = 0;
    this._runtimeDataset = {};
    this._runtimeTotalScans = 0;
    this._runtimeCallbacks = { onUpdate: null, onComplete: null };
    this._onTabsUpdatedRef = null;

    this.initListener();
  }

  initListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // ONE-TIME
      if (message.type === "analyzer_scanResult" && message.data?.html) {
        const results = this.processHtml(message.data.html);

        const timestamp = Date.now();
        const meta = {
          timestamp,
          tabId: sender?.tab?.id ?? null,
          url: sender?.tab?.url ?? null,
        };

        const key = `analyzerResults_${timestamp}`;
        browser.storage.local.set({ [key]: { meta, results } }).catch(() => {});

        this._setSessionValue("analyzer_lastResult", { meta, results });
        if (meta.tabId != null) {
          this._updateSessionMap("analyzer_lastByTab", (map) => {
            map[meta.tabId] = { meta, results };
            return map;
          });
        }

        if (this.resultCallback) {
          const cb = this.resultCallback;
          this.resultCallback = null;
          try { cb(results); } catch {}
        }

        sendResponse?.({ status: "ok", received: true });
        return true;
      }

      // RUNTIME
      if (message.type === "analyzer_runtimeScanResult" && message.data?.html) {
        if (!this._runtimeActive) return;

        try {
          const html = message.data.html;
          const tabId = sender?.tab?.id ?? null;
          const url = message.data.url || sender?.tab?.url || null;
          const title = message.data.title || sender?.tab?.title || null;
          const timestamp = message.data.timestamp || Date.now();

          const results = this.processHtml(html);
          const meta = { tabId, url, title: results?.head?.title || title || null, timestamp };

          const key = meta.url || "(url_sconosciuto)";
          if (!this._runtimeDataset[key]) this._runtimeDataset[key] = [];
          this._runtimeDataset[key].push({ meta, results });
          this._runtimeTotalScans += 1;

          this._runtimeCallbacks.onUpdate?.(key, {
            totalScans: this._runtimeTotalScans,
            pagesCount: Object.keys(this._runtimeDataset).length,
            startedAt: this._runtimeStartedAt
          });
        } catch {}
      }
    });
  }

  // ---------- Helpers storage.session ----------
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

  // ---------- ONE-TIME ----------
  _isInjectableUrl(url = "") {
    // consenti solo http/https; blocca edge://, chrome://, about:, chrome-extension://, ecc.
    return /^https?:\/\//i.test(url);
  }

  async runOneTimeScan(tabId, callback) {
    // ritorna una Promise che si risolve con i risultati o si rifiuta con un errore
    const tab = await browser.tabs.get(tabId).catch(() => null);
    const url = tab?.url || "";

    if (!this._isInjectableUrl(url)) {
      throw new Error("Questa pagina non consente l'iniezione del content script (protocollo non supportato).");
    }

    return new Promise(async (resolve, reject) => {
      let settled = false;
      const finish = (err, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.resultCallback = null;
        if (err) reject(err); else resolve(data);
      };

      // Wrappa il callback utente per risolvere la Promise quando arrivano i risultati
      const userCb = callback;
      this.resultCallback = (data) => {
        try { userCb?.(data); } catch {}
        finish(null, data);
      };

      // Prova l'injection
      try {
        if (browser.scripting) {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ["content_script/analyzer/analyzer_onetime_injected.js"]
          });
        } else {
          await browser.tabs.executeScript(tabId, { file: "content_script/analyzer/analyzer_onetime_injected.js" });
        }
      } catch (e) {
        return finish(new Error("Iniezione non riuscita su questa pagina."));
      }

      // Timeout se lo script non risponde (es. CSP/errore runtime)
      const timer = setTimeout(() => {
        finish(new Error("Timeout: la pagina non ha risposto alla scansione."));
      }, 8000);
    });
  }

  async getLocalScanResults() {
    const all = await browser.storage.local.get(null);
    return Object.entries(all)
      .filter(([key]) => key.startsWith("analyzerResults_"))
      .map(([key, value]) => ({ key, results: value }));
  }

  // ---------- RUNTIME (public API) ----------
  async startRuntimeScan({ onUpdate, onComplete } = {}) {
    if (this._runtimeActive) return;

    this._runtimeActive = true;
    this._runtimeStartedAt = Date.now();
    this._runtimeDataset = {};
    this._runtimeTotalScans = 0;
    this._runtimeCallbacks = { onUpdate: onUpdate || null, onComplete: onComplete || null };

    this._onTabsUpdatedRef = async (tabId, changeInfo, tab) => {
      if (!this._runtimeActive) return;
      if (changeInfo.status === "complete" && tab?.url && /^https?:/i.test(tab.url)) {
        await this._injectRuntimeScript(tabId);
      }
    };
    try { browser.tabs.onUpdated.addListener(this._onTabsUpdatedRef); } catch {}

    try {
      const tabs = await browser.tabs.query({});
      for (const t of tabs) {
        if (t?.id && t?.url && /^https?:/i.test(t.url)) {
          await this._injectRuntimeScript(t.id);
        }
      }
    } catch {}

    this._runtimeCallbacks.onUpdate?.(null, {
      totalScans: 0,
      pagesCount: 0,
      startedAt: this._runtimeStartedAt
    });
  }

  async stopRuntimeScan() {
    if (!this._runtimeActive) return { ok: false, error: "Runtime non attivo" };

    const stoppedAt = Date.now();
    const run = {
      startedAt: this._runtimeStartedAt,
      stoppedAt,
      totalScans: this._runtimeTotalScans,
      pagesCount: Object.keys(this._runtimeDataset).length,
      dataset: this._runtimeDataset
    };

    const key = `analyzerRuntime_${stoppedAt}`;
    await browser.storage.local.set({ [key]: run, analyzerRuntime_lastKey: key }).catch(() => {});

    this._runtimeActive = false;
    try { this._onTabsUpdatedRef && browser.tabs.onUpdated.removeListener(this._onTabsUpdatedRef); } catch {}
    this._onTabsUpdatedRef = null;

    this._runtimeCallbacks.onComplete?.({ ok: true, key, run });

    return { ok: true, key, run };
  }

  getRuntimeStatus() {
    return {
      runtimeActive: this._runtimeActive,
      startedAt: this._runtimeStartedAt,
      totalScans: this._runtimeTotalScans,
      pagesCount: Object.keys(this._runtimeDataset).length
    };
  }

  async getLastRuntimeResults() {
    const all = await browser.storage.local.get(null);
    let key = all.analyzerRuntime_lastKey || null;
    if (!key) {
      const keys = Object.keys(all).filter(k => k.startsWith("analyzerRuntime_"));
      if (keys.length) {
        keys.sort((a, b) => Number(b.split("_")[1]) - Number(a.split("_")[1]));
        key = keys[0];
      }
    }
    return key ? { key, run: all[key] } : { key: null, run: null };
  }

  async getAllRuntimeResults() {
    const all = await browser.storage.local.get(null);
    const items = Object.entries(all)
      .filter(([key]) => {
        if (!key.startsWith("analyzerRuntime_")) return false;
        const suffix = key.split("_")[1];
        return /^\d+$/.test(suffix);
      })
      .map(([key, run]) => ({ key, run }));

    items.sort((a, b) => Number(b.key.split("_")[1]) - Number(a.key.split("_")[1]));
    return items;
  }

  async _injectRuntimeScript(tabId) {
    try {
      if (browser.scripting) {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ["content_script/analyzer/analyzer_runtime_injected.js"]
        });
      } else {
        await browser.tabs.executeScript(tabId, { file: "content_script/analyzer/analyzer_runtime_injected.js" });
      }
    } catch {}
  }

  // ---------- Parser HTML ----------
  processHtml(html) {
    const $ = cheerio.load(html);

    // Helpers di normalizzazione/filtraggio
    const norm = (s) => String(s ?? "")
      .replace(/\u00A0/g, " ")   // nbsp → spazio
      .replace(/\s+/g, " ")      // spazi multipli → singolo
      .trim();

    const isDashOnly = (s) => /^[-–—•]+$/.test(s);  // solo trattini/pallini
    const isMeaningfulText = (s) => {
      const t = norm(s);
      return t.length > 0 && !isDashOnly(t);
    };

    const nonEmpty = (v) => v != null && norm(v) !== "";
    const ensureArray = (arr) => Array.isArray(arr) ? arr : [];
    const filterMap = (arr, mapFn, keepFn = Boolean) =>
      ensureArray(arr).map(mapFn).filter(keepFn);

    // Profondità DOM (invariata)
    function getDepth(node, depth = 0) {
      const children = $(node).children();
      if (children.length === 0) return depth;
      return Math.max(...children.map((_, child) => getDepth(child, depth + 1)).get());
    }

    // HEAD
    const headTitle = (() => {
      const t = norm($("title").text());
      return t || null;
    })();

    const headMeta = filterMap(
      $("meta").get(),
      (el) => {
        const name = norm($(el).attr("name") || $(el).attr("property") || "");
        const content = norm($(el).attr("content") || "");
        return { name: name || null, content: content || null };
      },
      (m) => nonEmpty(m.name) || nonEmpty(m.content) // scarta meta del tutto vuoti
    );

    const headLinks = filterMap(
      $("head link").get(),
      (el) => {
        const rel = norm($(el).attr("rel") || "");
        const href = norm($(el).attr("href") || "");
        return { rel: rel || null, href: href || null };
      },
      (l) => nonEmpty(l.rel) || nonEmpty(l.href) // serve almeno una info
    );

    const headScripts = filterMap(
      $("head script").get(),
      (el) => {
        const src = norm($(el).attr("src") || "");
        const inlineRaw = $(el).html() ?? "";
        const inline = norm(inlineRaw).slice(0, 50); // preview breve
        return {
          src: src || null,
          inline: inline || null
        };
      },
      (s) => nonEmpty(s.src) || nonEmpty(s.inline) // scarta <script> totalmente vuoti
    );

    // BODY → HEADINGS
    const headings = {
      h1: filterMap($("h1").get(), (el) => norm($(el).text() || ""), isMeaningfulText),
      h2: filterMap($("h2").get(), (el) => norm($(el).text() || ""), isMeaningfulText),
      h3: filterMap($("h3").get(), (el) => norm($(el).text() || ""), isMeaningfulText),
      h4: filterMap($("h4").get(), (el) => norm($(el).text() || ""), isMeaningfulText),
      h5: filterMap($("h5").get(), (el) => norm($(el).text() || ""), isMeaningfulText),
      h6: filterMap($("h6").get(), (el) => norm($(el).text() || ""), isMeaningfulText),
    };

    // BODY → LINKS (serve almeno href o testo)
    const bodyLinks = filterMap(
      $("a").get(),
      (el) => ({
        href: norm($(el).attr("href") || ""),
        text: norm($(el).text() || "")
      }),
      (l) => nonEmpty(l.href) || isMeaningfulText(l.text)
    );

    // BODY → FORMS (filtra input non informativi; scarta form completamente vuoti)
    const bodyForms = filterMap(
      $("form").get(),
      (form) => {
        const action = norm($(form).attr("action") || "");
        const method = norm($(form).attr("method") || "GET"); // mantieni default
        const inputs = filterMap(
          $(form).find("input, select, textarea, button").get(),
          (el) => ({
            tag: (el.tagName || "").toLowerCase() || null,
            name: norm($(el).attr("name") || "") || null,
            type: norm($(el).attr("type") || (el.tagName || "").toLowerCase()) || null,
            value: norm($(el).attr("value") || "") || null,
            placeholder: norm($(el).attr("placeholder") || "") || null
          }),
          // tieni input se ha almeno una info "utente-utile"
          (i) => nonEmpty(i.name) || nonEmpty(i.value) || nonEmpty(i.placeholder)
        );

        // tieni il form se ha action/metadati o almeno un input informativo
        const keep = nonEmpty(action) || nonEmpty(method) || inputs.length > 0;
        return keep ? { action: action || null, method: method || null, inputs } : null;
      },
      Boolean
    );

    // BODY → MEDIA
    const bodyImages = filterMap(
      $("img").get(),
      (el) => {
        const src = norm($(el).attr("src") || "");
        const alt = norm($(el).attr("alt") || "");
        return { src: src || null, alt }; // alt può essere vuoto per immagini decorative
      },
      (img) => nonEmpty(img.src) // scarta immagini senza src
    );

    const bodyVideos = filterMap(
      $("video").get(),
      (el) => {
        const src = norm($(el).attr("src") || "");
        const controls = $(el).attr("controls") !== undefined;
        return { src: src || null, controls: Boolean(controls) };
      },
      (v) => nonEmpty(v.src) || v.controls // tieni se almeno ha src o controls
    );

    const bodyAudios = filterMap(
      $("audio").get(),
      (el) => {
        const src = norm($(el).attr("src") || "");
        const controls = $(el).attr("controls") !== undefined;
        return { src: src || null, controls: Boolean(controls) };
      },
      (a) => nonEmpty(a.src) || a.controls
    );

    const bodyIframes = filterMap(
      $("iframe").get(),
      (el) => {
        const src = norm($(el).attr("src") || "");
        const title = norm($(el).attr("title") || "");
        return { src: src || null, title: title || null };
      },
      (f) => nonEmpty(f.src) || nonEmpty(f.title)
    );

    // BODY → LISTE (scarta li vuoti/solo trattini; poi scarta le liste senza item)
    const bodyLists = filterMap(
      $("ul, ol").get(),
      (el) => {
        const type = (el.tagName || "").toLowerCase();
        const items = filterMap(
          $(el).find("li").get(),
          (li) => norm($(li).text() || ""),
          isMeaningfulText
        );
        return items.length ? { type, items } : null;
      },
      Boolean
    );

    // BODY → TABELLE (scarta righe con sole celle vuote/dash; poi scarta tabelle vuote)
    const bodyTables = filterMap(
      $("table").get(),
      (el) => {
        const rows = filterMap(
          $(el).find("tr").get(),
          (row) => {
            const cells = filterMap(
              $(row).find("th, td").get(),
              (cell) => norm($(cell).text() || ""),
              isMeaningfulText // tieni solo celle con contenuto reale
            );
            return cells.length ? cells : null;
          },
          Boolean
        );
        return rows.length ? { rows } : null;
      },
      Boolean
    );

    // STATS (invariati: contano il DOM reale, non il “post-filtrato”)
    const stats = {
      totalElements: $("*").length,
      depth: getDepth("html", 0),
      tagCount: $("*")
        .map((i, el) => el.tagName)
        .get()
        .reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {})
    };

    return {
      head: {
        title: headTitle,
        meta: headMeta,
        links: headLinks,
        scripts: headScripts
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
        tables: bodyTables
      },
      stats
    };
  }
}

export default AnalyzerEngine;

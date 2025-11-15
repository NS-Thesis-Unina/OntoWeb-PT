import browser from "webextension-polyfill";
import { Wappalyzer } from "../../../public/packages/wappalyzer/wappalyzer.js";

// Loading Wappalyzer Rules
async function loadJson(path) {
  const res = await fetch(browser.runtime.getURL(path));
  return res.json();
}

let TECH = {};
let CATS = {};
let WAF_TECH = {};
let WAF_CATS = {};

(async () => {
  const tech = await loadJson("packages/wappalyzer/technologies.json");
  TECH = tech.technologies;
  CATS = tech.categories;

  const waf = await loadJson("packages/wappalyzer/waf.json");
  WAF_TECH = waf.technologies;
  WAF_CATS = waf.categories;
})();

// Helpers
const tabSessions = new Map();

function ensureTabSession(tabId) {
  if (!tabSessions.has(tabId)) {
    tabSessions.set(tabId, {
      headersAgg: new Map(),
      requests: [],
      origins: new Set(),
      cookies: [],
    });
  }
  return tabSessions.get(tabId);
}

function resetWappalyzer(mod, tech, cats) {
  mod.technologies = [];
  mod.categories = [];
  mod.requires = [];
  mod.categoryRequires = [];
  mod.setTechnologies(tech);
  mod.setCategories(cats);
}

// Capture headers
if (typeof chrome !== "undefined" && chrome.webRequest) {
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      const td = ensureTabSession(details.tabId);
      const origin = (() => {
        try {
          return new URL(details.url).origin;
        } catch {
          return null;
        }
      })();
      if (origin) td.origins.add(origin);

      (details.responseHeaders || []).forEach((h) => {
        const name = h.name?.toLowerCase();
        if (!name) return;
        if (!td.headersAgg.has(name)) td.headersAgg.set(name, new Set());
        if (h.value != null) td.headersAgg.get(name).add(String(h.value));
      });

      td.requests.push({
        url: details.url,
        responseHeaders: (details.responseHeaders || []).map((h) => ({
          name: (h.name || "").toLowerCase(),
          value: h.value || "",
        })),
      });
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders", "extraHeaders"]
  );
}

// Helpers
function headerSetsToMap(hsets = new Map()) {
  const out = {};
  for (const [k, set] of hsets.entries()) {
    out[k] = Array.from(set);
  }
  return out;
}

function toMetaMap(metaArr = []) {
  const out = {};
  for (const m of metaArr) {
    const keys = [];
    if (m.name) keys.push(m.name.toLowerCase());
    if (m.property) keys.push(m.property.toLowerCase());
    const content = (m.content ?? "").trim();
    if (!content) continue;
    for (const k of keys) {
      if (!out[k]) out[k] = [];
      out[k].push(content);
    }
  }
  return out;
}

function joinInlineScripts(inlineArr = []) {
  return inlineArr.slice(0, 20).map(s => (s || "").substring(0, 50_000)).join("\n");
}

function toCookieMap(cookieArr = []) {
  const out = {};
  for (const c of cookieArr) {
    if (!c?.name) continue;
    const key = c.name.toLowerCase();
    if (!out[key]) out[key] = [];
    if (c.value != null) out[key].push(String(c.value));
  }
  return out;
}

function checkSecureHeaders(requests = []) {
  const findings = [];
  const data = {
    "x-xss-protection": [],
    "x-content-type-options": [],
    "strict-transport-security": [],
    "x-powered-by": [],
    "x-frame-options": []
  };

  for (const req of requests) {
    const headers = {};
    req.responseHeaders.forEach(h => {
      headers[h.name] = (h.value || "").toLowerCase();
    });

    if (headers["content-type"]?.includes("text/html")) {
      if (headers["x-xss-protection"]) data["x-xss-protection"].push(req.url);
      if (headers["x-frame-options"]) data["x-frame-options"].push(req.url);
      if (headers["x-powered-by"]) data["x-powered-by"].push(req.url);

      if (!headers["x-content-type-options"] || headers["x-content-type-options"] !== "nosniff") {
        data["x-content-type-options"].push(req.url);
      }
      if (req.url.startsWith("https://") && !headers["strict-transport-security"]) {
        data["strict-transport-security"].push(req.url);
      }
    }
  }

  if (data["x-content-type-options"].length)
    findings.push({ header: "X-Content-Type-Options", description: "X-Content-Type-Options header not found or wrong value", urls: data["x-content-type-options"] });
  if (data["strict-transport-security"].length)
    findings.push({ header: "HSTS", description: "Strict-Transport-Security header not found", urls: data["strict-transport-security"] });
  if (data["x-powered-by"].length)
    findings.push({ header: "X-Powered-By", description: "X-Powered-By header reveals server configuration", urls: data["x-powered-by"] });
  if (data["x-frame-options"].length)
    findings.push({ header: "X-Frame-Options", description: "X-Frame-Options header is deprecated", urls: data["x-frame-options"] });
  if (data["x-xss-protection"].length)
    findings.push({ header: "X-XSS-Protection", description: "X-XSS-Protection header is deprecated", urls: data["x-xss-protection"] });

  return findings;
}


class TechStackEngine {
  async runOneTimeStackScan(tabId, callback) {
    try {
      const td = ensureTabSession(tabId);

      // Inject content script
      if (browser.scripting) {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ["content_script/techstack/techstack_injected.js"],
        });
      } else {
        await browser.tabs.executeScript(tabId, { file: "content_script/techstack/techstack_injected.js" });
      }

      // Content script analysis request
      const rsp = await browser.tabs.sendMessage(tabId, { action: "analyzeStack" });
      if (!rsp?.ok || !rsp.info) throw new Error(rsp?.error || "Content script didn’t respond.");

      const { meta, scriptSrc, scripts: inlineScripts, html, domFindings, jsFindings, url: pageUrl } = rsp.info;

      const headers = headerSetsToMap(td.headersAgg);
      const metaMap = toMetaMap(meta);
      const scripts = joinInlineScripts(inlineScripts);

      // cookies
      let cookieList = [];
      let cookieMap = {};
      try {
        const origins = Array.from(td.origins);
        const promises = origins.map((origin) => browser.cookies.getAll({ url: origin }).catch(() => []));
        const all = (await Promise.all(promises)).flat();
        cookieMap = toCookieMap(all);
        cookieList = all.map(c => ({ domain: c.domain, name: c.name, value: c.value, httpOnly: c.httpOnly }));
      } catch (e) {
        console.warn("[Engine] cookies.getAll failed:", e);
      }

      // tech
      resetWappalyzer(Wappalyzer, TECH, CATS);
      let detections = Wappalyzer.analyze({ headers, meta: metaMap, scriptSrc, scripts, html, url: pageUrl, cookies: cookieMap });
      detections = detections.concat(
        ...domFindings.map(({ name, selector, exists, text, property, attribute, value }) => {
          const tech = Wappalyzer.technologies.find(t => t.name === name);
          if (!tech) return [];
          if (typeof exists !== "undefined") return Wappalyzer.analyzeManyToMany(tech, "dom.exists", { [selector]: [""] });
          if (text) return Wappalyzer.analyzeManyToMany(tech, "dom.text", { [selector]: [text] });
          if (property) return Wappalyzer.analyzeManyToMany(tech, `dom.properties.${property}`, { [selector]: [value] });
          if (attribute) return Wappalyzer.analyzeManyToMany(tech, `dom.attributes.${attribute}`, { [selector]: [value] });
          return [];
        })
      ).concat(
        ...jsFindings.map(({ name, chain, value }) => {
          const tech = Wappalyzer.technologies.find(t => t.name === name);
          if (!tech) return [];
          return Wappalyzer.analyzeManyToMany(tech, "js", { [chain]: [value] });
        })
      );

      const resolved = Wappalyzer.resolve(detections);
      const technologies = resolved.map(t => ({ name: t.name, version: t.version || "" }));

      // WAF
      resetWappalyzer(Wappalyzer, WAF_TECH, WAF_CATS);
      const wafResolved = Wappalyzer.resolve(
        Wappalyzer.analyze({ headers, meta: metaMap, scriptSrc, scripts, html, url: pageUrl, cookies: cookieMap })
      );
      const waf = wafResolved.map(t => ({ name: t.name, version: t.version || "" }));

      // secure headers
      const secureHeaders = checkSecureHeaders(td.requests);

      // storages
      const localStorageDump = await browser.tabs.sendMessage(tabId, { action: "dumpLocalStorage" }).catch(() => []);
      const sessionStorageDump = await browser.tabs.sendMessage(tabId, { action: "dumpSessionStorage" }).catch(() => []);

      const results = {
        technologies,
        waf,
        secureHeaders,
        cookies: cookieList,
        storage: { localStorage: localStorageDump, sessionStorage: sessionStorageDump },
        raw: { resolved, wafResolved }
      };

      try {
        const timestamp = Date.now();
        const metaSaved = {
          timestamp,
          tabId,
          url: pageUrl || null
        };

        const key = `techstackResults_${timestamp}`;
        // local store (archive)
        try {
          await browser.storage.local.set({ [key]: { meta: metaSaved, results } }).catch(() => {});
        } catch {}

        // session last result
        try {
          if (browser.storage?.session?.set) {
            await browser.storage.session.set({ techstack_lastResult: { meta: metaSaved, results } });
          }
        } catch {}

        // session per tab map
        try {
          if (browser.storage?.session?.get && browser.storage?.session?.set) {
            const obj = await browser.storage.session.get("techstack_lastByTab");
            const map = obj?.techstack_lastByTab ?? {};
            map[tabId] = { meta: metaSaved, results };
            await browser.storage.session.set({ techstack_lastByTab: map });
          }
        } catch {}
      } catch (e) {
        console.warn("[TechStackEngine] session/local save failed", e);
      }

      // callback to UI
      callback({ meta: { tabId, url: pageUrl, timestamp: Date.now() }, results });

    } catch (err) {
      throw new Error(err?.message || "TechStack analysis error.");
    }
  }

  // ===== Persistence retrieval helpers =====
  async getLocalStackResults() {
    try {
      const all = await browser.storage.local.get(null);
      return Object.entries(all)
        .filter(([key]) => key.startsWith("techstackResults_"))
        .map(([key, value]) => ({ key, results: value }));
    } catch {
      return [];
    }
  }

  async getSessionLast() {
    try {
      if (!browser.storage?.session?.get) return null;
      const obj = await browser.storage.session.get("techstack_lastResult");
      return obj?.techstack_lastResult ?? null;
    } catch {
      return null;
    }
  }

  async getSessionLastForTab(tabId) {
    try {
      if (!browser.storage?.session?.get) return null;
      const obj = await browser.storage.session.get("techstack_lastByTab");
      const map = obj?.techstack_lastByTab ?? {};
      return map[tabId] ?? null;
    } catch {
      return null;
    }
  }

  getRuntimeStatus() {
    return { runtimeActive: false };
  }

  // ===== Deletion helpers =====

  /**
   * Delete a single tech stack result by key (techstackResults_<timestamp>).
   * It will remove the local archive entry and clean session references that point to that timestamp.
   */
  async deleteResultById(resultKey) {
    const key = String(resultKey || "");

    if (!key.startsWith("techstackResults_")) {
      throw new Error("Invalid tech stack result key.");
    }

    // Parse timestamp from key suffix
    const tsStr = key.split("_")[1];
    const ts = Number(tsStr);
    const targetTimestamp = Number.isFinite(ts) ? ts : null;

    let removedLocal = false;
    let clearedSessionLast = false;
    let clearedSessionTabs = 0;

    // Remove from local archive
    try {
      const existing = await browser.storage.local.get(key);
      if (existing && Object.prototype.hasOwnProperty.call(existing, key)) {
        await browser.storage.local.remove(key);
        removedLocal = true;
      }
    } catch {
      // ignore, we will still check session
    }

    // Remove references from session storage
    if (browser.storage?.session?.get && browser.storage?.session?.set) {
      try {
        const obj = await browser.storage.session.get([
          "techstack_lastResult",
          "techstack_lastByTab",
        ]);

        const last = obj?.techstack_lastResult ?? null;
        const byTab = obj?.techstack_lastByTab ?? null;

        // If lastResult matches this timestamp, remove the key
        if (
          targetTimestamp != null &&
          last?.meta?.timestamp === targetTimestamp &&
          browser.storage.session.remove
        ) {
          await browser.storage.session.remove("techstack_lastResult");
          clearedSessionLast = true;
        }

        // If any tab entry matches this timestamp, drop only those entries
        if (targetTimestamp != null && byTab && typeof byTab === "object") {
          const newMap = { ...byTab };
          let changed = false;

          for (const [tabId, val] of Object.entries(byTab)) {
            if (val?.meta?.timestamp === targetTimestamp) {
              delete newMap[tabId];
              clearedSessionTabs++;
              changed = true;
            }
          }

          if (changed) {
            await browser.storage.session.set({ techstack_lastByTab: newMap });
          }
        }
      } catch {
        // ignore
      }
    }

    if (!removedLocal && !clearedSessionLast && clearedSessionTabs === 0) {
      // Not found anywhere
      throw new Error("Tech stack scan not found in storage.");
    }

    return { removedLocal, clearedSessionLast, clearedSessionTabs };
  }

  /**
   * Delete all tech stack results from local and session storage.
   */
  async clearAllResults() {
    let removedKeys = 0;
    let clearedSessionLast = false;
    let clearedSessionTabs = false;

    // Remove all local archive entries
    try {
      const all = await browser.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter((k) =>
        k.startsWith("techstackResults_")
      );

      if (keysToRemove.length > 0) {
        await browser.storage.local.remove(keysToRemove);
        removedKeys = keysToRemove.length;
      }
    } catch {
      // ignore
    }

    // Remove session helpers
    if (browser.storage?.session?.remove) {
      try {
        await browser.storage.session.remove([
          "techstack_lastResult",
          "techstack_lastByTab",
        ]);
        clearedSessionLast = true;
        clearedSessionTabs = true;
      } catch {
        // ignore
      }
    } else if (browser.storage?.session?.set) {
      // Fallback: overwrite with empty values if remove is not available
      try {
        await browser.storage.session.set({
          techstack_lastResult: null,
          techstack_lastByTab: {},
        });
        clearedSessionLast = true;
        clearedSessionTabs = true;
      } catch {
        // ignore
      }
    }

    return { removedKeys, clearedSessionLast, clearedSessionTabs };
  }
}

export default TechStackEngine;

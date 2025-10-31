// deepCaptureChrome.js
// Deep capture via Chrome DevTools Protocol (Chromium-based browsers).
// Requires "debugger" permission in manifest (you already have it).
// Exports: DeepCaptureChrome, isChromeLike

const isChromeLike = typeof chrome !== "undefined" && !!chrome.debugger;

class DeepCaptureChrome {
  constructor(onEntry) {
    this.onEntry = onEntry;              // function(entry, tabId, frameUrl)
    this.attachedTabs = new Set();       // tabIds we called attach on
    this.sessions = new Map();           // sessionId -> { tabId, requests: Map() }
    this.boundOnEvent = this._onEvent.bind(this);
    this._listening = false;
  }

  async attachToTab(tabId) {
    if (!isChromeLike) return false;
    if (this.attachedTabs.has(tabId)) return true;

    return new Promise((resolve) => {
      chrome.debugger.attach({ tabId }, "1.3", () => {
        if (chrome.runtime.lastError) return resolve(false);
        this.attachedTabs.add(tabId);

        // Enable Network domain for the main target; we'll also set auto-attach
        chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
          chrome.debugger.sendCommand({ tabId }, "Target.setAutoAttach", {
            autoAttach: true,
            waitForDebuggerOnStart: false,
            flatten: true
          }, () => {
            // Start listening once (global across tabs)
            if (!this._listening) {
              chrome.debugger.onEvent.addListener(this.boundOnEvent);
              this._listening = true;
            }
            resolve(true);
          });
        });
      });
    });
  }

  async detachFromAll() {
    if (!isChromeLike) return;
    try {
      if (this._listening) {
        chrome.debugger.onEvent.removeListener(this.boundOnEvent);
        this._listening = false;
      }
    } catch {}
    for (const tabId of Array.from(this.attachedTabs)) {
      try { chrome.debugger.detach({ tabId }); } catch {}
      this.attachedTabs.delete(tabId);
    }
    this.sessions.clear();
  }

  _ensureSession(sessionId, tabId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { tabId, requests: new Map(), frameUrlMap: new Map() });
      // enable network in the session (best effort)
      try {
        chrome.debugger.sendCommand({ tabId }, "Network.enable", { sessionId }, () => {});
      } catch {}
    }
    return this.sessions.get(sessionId);
  }

  _onEvent(source, method, params) {
    // source.tabId exists for all events we receive
    const tabId = source?.tabId;
    // some events include sessionId (for auto-attached subtargets)
    const sessionId = params?.sessionId || undefined;

    // When a new target (iframe/worker) is attached (Target.attachedToTarget),
    // the event contains sessionId and targetInfo.
    if (method === "Target.attachedToTarget") {
      const sId = params?.sessionId;
      const targetInfo = params?.targetInfo;
      if (!sId || !tabId) return;
      const sess = this._ensureSession(sId, tabId);
      // store frame url if available
      if (targetInfo?.url) sess.frameUrlMap.set(sId, targetInfo.url);
      // enable network for this session
      try {
        chrome.debugger.sendCommand({ tabId }, "Network.enable", { sessionId: sId }, () => {});
      } catch {}
      return;
    }

    // If sessionId present try session-store, otherwise create a "main:tabId" session
    const actualSessionId = sessionId || ("main:" + tabId);
    const sess = this._ensureSession(actualSessionId, tabId);
    const store = sess.requests;

    // requestWillBeSent
    if (method === "Network.requestWillBeSent") {
      const { requestId, request, documentURL, frameId } = params;
      store.set(requestId, {
        url: request?.url || "",
        method: request?.method || "GET",
        ts: Date.now(),
        requestBody: request?.postData || null,
        requestHeaders: request?.headers || {},
        frameId,
        documentURL: documentURL || null
      });
      return;
    }

    // responseReceived
    if (method === "Network.responseReceived") {
      const { requestId, response } = params;
      const rec = store.get(requestId) || { url: response?.url || "", method: "GET", ts: Date.now() };
      rec.status = response?.status;
      rec.statusText = response?.statusText || "";
      rec.responseHeaders = response?.headers || {};
      rec.mimeType = response?.mimeType || "";
      rec.fromServiceWorker = !!response?.fromServiceWorker;
      rec.timing = response?.timing || null;
      store.set(requestId, rec);
      return;
    }

    // requestServedFromCache
    if (method === "Network.requestServedFromCache") {
      const { requestId } = params;
      const rec = store.get(requestId) || { ts: Date.now() };
      rec.servedFromCache = true;
      store.set(requestId, rec);
      return;
    }

    // loadingFailed
    if (method === "Network.loadingFailed") {
      const { requestId, errorText } = params;
      const rec = store.get(requestId) || { ts: Date.now() };
      const entry = {
        meta: { ts: rec.ts || Date.now(), tabId, pageUrl: rec.documentURL || null, frameId: rec.frameId || null },
        request: {
          url: rec.url || "",
          method: rec.method || "GET",
          headers: rec.requestHeaders || {},
          body: rec.requestBody || null,
          bodyEncoding: rec.requestBody ? "text" : "none",
          bodySize: rec.requestBody ? rec.requestBody.length : 0,
          truncated: false
        },
        response: { networkError: String(errorText || "loadingFailed") }
      };
      try { this.onEntry(entry, tabId, rec.documentURL || null); } catch {}
      store.delete(requestId);
      return;
    }

    // loadingFinished -> attempt to getResponseBody
    if (method === "Network.loadingFinished") {
      const { requestId } = params;
      const rec = store.get(requestId);
      if (!rec) return;

      // Build callback to call onEntry once we have body (or not)
      const cb = (res) => {
        const body = res?.body ?? null;
        const base64Encoded = !!res?.base64Encoded;
        const bodyEncoding = base64Encoded ? "base64" : (body ? "text" : "none");
        const bodySize = body ? (base64Encoded ? Math.ceil(body.length * 3 / 4) : body.length) : 0;

        const entry = {
          meta: { ts: rec.ts || Date.now(), tabId, pageUrl: rec.documentURL || null, frameId: rec.frameId || null },
          request: {
            url: rec.url,
            method: rec.method,
            headers: rec.requestHeaders || {},
            body: rec.requestBody || null,
            bodyEncoding: rec.requestBody ? "text" : "none",
            bodySize: rec.requestBody ? rec.requestBody.length : 0,
            truncated: false
          },
          response: {
            status: rec.status || 0,
            statusText: rec.statusText || "",
            headers: rec.responseHeaders || {},
            body,
            bodyEncoding,
            bodySize,
            truncated: false,
            servedFromCache: !!rec.servedFromCache,
            fromServiceWorker: !!rec.fromServiceWorker
          }
        };

        try { this.onEntry(entry, tabId, rec.documentURL || null); } catch (e) {}
        store.delete(requestId);
      };

      // Try to get body; if it fails, still call cb with null
      try {
        // pass sessionId if this is a sub-session (some chrome versions require it)
        const extra = {};
        if (sessionId) extra.sessionId = sessionId;
        chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId, ...extra }, (res) => {
          if (chrome.runtime.lastError) {
            // body not available, call cb without body
            cb(null);
          } else {
            cb(res);
          }
        });
      } catch (e) {
        cb(null);
      }
      return;
    }
  }
}

export { DeepCaptureChrome, isChromeLike };

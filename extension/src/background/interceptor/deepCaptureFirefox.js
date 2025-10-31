// deepCaptureFirefox.js
// Deep capture for Firefox using webRequest + filterResponseData
// Exports: DeepCaptureFirefox, isFirefoxLike
//
// Behavior: collects request metadata onBeforeRequest (including requestBody when present),
// uses onHeadersReceived to start a filterResponseData stream and collects response body chunks,
// then onstop composes the full body and calls onEntry(entry, tabId, frameUrl).
//
// Note: filterResponseData is a Firefox-only API (WebExtensions).

const isFirefoxLike = typeof browser !== "undefined" && !!browser.webRequest && !!browser.webRequest.filterResponseData;

class DeepCaptureFirefox {
  constructor(onEntry) {
    this.onEntry = onEntry; // (entry, tabId, frameUrl) => void
    this.reqMap = new Map(); // requestId -> meta
    this._listeners = [];
    this._init();
  }

  _init() {
    if (!isFirefoxLike) return;

    // onBeforeRequest: capture URL, method, requestBody if available
    const before = (details) => {
      try {
        this.reqMap.set(details.requestId, {
          url: details.url,
          method: details.method || "GET",
          ts: Date.now(),
          tabId: details.tabId ?? null,
          frameId: details.frameId ?? null,
          documentUrl: details.documentUrl || null,
          requestHeaders: {}, // fill from onBeforeSendHeaders if needed
          requestBody: null
        });
        if (details.requestBody) {
          // Try to extract textual content (raw[0].bytes) or formData
          try {
            if (details.requestBody.formData) {
              // formData is an object with arrays
              const pairs = [];
              for (const k of Object.keys(details.requestBody.formData)) {
                for (const v of details.requestBody.formData[k]) {
                  pairs.push(`${k}=${v}`);
                }
              }
              const txt = pairs.join("&");
              this.reqMap.get(details.requestId).requestBody = txt;
            } else if (details.requestBody.raw && details.requestBody.raw.length) {
              // raw is array of ArrayBuffer-like (Uint8Array) accessible as bytes
              const raw = details.requestBody.raw[0];
              if (raw && raw.bytes) {
                // bytes is ArrayBuffer; convert to string if likely textual
                try {
                  const arr = new Uint8Array(raw.bytes);
                  const dec = new TextDecoder();
                  const text = dec.decode(arr);
                  this.reqMap.get(details.requestId).requestBody = text;
                } catch {
                  // binary - skip body (we keep null)
                }
              }
            }
          } catch {}
        }
      } catch {}
    };

    // onHeadersReceived: start filterResponseData to capture response body
    const onHeaders = (details) => {
      try {
        // attempt to create a filter for this requestId
        if (details?.requestId && typeof browser.webRequest.filterResponseData === "function") {
          try {
            const filter = browser.webRequest.filterResponseData(details.requestId);
            const chunks = [];
            filter.ondata = (event) => {
              // event.data is ArrayBuffer
              try { chunks.push(event.data); } catch {}
              // pass-through
              try { filter.write(event.data); } catch {}
            };
            filter.onstop = async () => {
              try {
                // concat ArrayBuffer chunks
                let totalLen = 0;
                for (const c of chunks) totalLen += c.byteLength;
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (const c of chunks) {
                  merged.set(new Uint8Array(c), offset);
                  offset += c.byteLength;
                }
                // Decide encoding based on headers (best-effort)
                const contentType = (details.responseHeaders || []).find(h => String(h.name).toLowerCase() === "content-type")?.value || "";
                let body = null;
                let bodyEncoding = "none";
                if (/^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded))/i.test(contentType) || contentType === "") {
                  try {
                    const dec = new TextDecoder();
                    body = dec.decode(merged);
                    bodyEncoding = "text";
                  } catch { body = null; }
                } else {
                  // base64 encode
                  let binary = "";
                  for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
                  body = btoa(binary);
                  bodyEncoding = "base64";
                }

                // Compose entry
                const reqMeta = this.reqMap.get(details.requestId) || {};
                const headersObj = {};
                try {
                  for (const h of details.responseHeaders || []) headersObj[String(h.name)] = String(h.value);
                } catch {}
                const entry = {
                  meta: { ts: reqMeta.ts || Date.now(), tabId: reqMeta.tabId ?? null, pageUrl: reqMeta.documentUrl || null, frameId: reqMeta.frameId ?? null },
                  request: {
                    url: reqMeta.url || details.url,
                    method: reqMeta.method || details.method || "GET",
                    headers: reqMeta.requestHeaders || {},
                    body: reqMeta.requestBody || null,
                    bodyEncoding: reqMeta.requestBody ? "text" : "none",
                    bodySize: reqMeta.requestBody ? String(reqMeta.requestBody).length : 0,
                    truncated: false
                  },
                  response: {
                    status: details.statusCode || 0,
                    statusText: details.statusLine || "",
                    headers: headersObj,
                    body,
                    bodyEncoding,
                    bodySize: merged.length,
                    truncated: false
                  }
                };

                try { this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null); } catch (e) {}
              } catch (e) {
                // ignore errors
              } finally {
                try { filter.disconnect(); } catch {}
                this.reqMap.delete(details.requestId);
              }
            };
            filter.onerror = (err) => {
              try { filter.disconnect(); } catch {}
              this.reqMap.delete(details.requestId);
            };
          } catch (e) {
            // filter could fail for e.g. data urls or other types
          }
        }
      } catch (e) {}
    };

    // onCompleted fallback (if filterResponseData isn't used or body is unavailable)
    const onComplete = (details) => {
      try {
        const reqMeta = this.reqMap.get(details.requestId) || {};
        // If response body not captured by filter, still notify minimal record
        const headersObj = {};
        try { for (const h of details.responseHeaders || []) headersObj[String(h.name)] = String(h.value); } catch {}
        const entry = {
          meta: { ts: reqMeta.ts || Date.now(), tabId: reqMeta.tabId ?? null, pageUrl: reqMeta.documentUrl || null, frameId: reqMeta.frameId ?? null },
          request: {
            url: reqMeta.url || details.url,
            method: reqMeta.method || details.method || "GET",
            headers: reqMeta.requestHeaders || {},
            body: reqMeta.requestBody || null,
            bodyEncoding: reqMeta.requestBody ? "text" : "none",
            bodySize: reqMeta.requestBody ? String(reqMeta.requestBody).length : 0,
            truncated: false
          },
          response: {
            status: details.statusCode || 0,
            statusText: "",
            headers: headersObj,
            body: null,
            bodyEncoding: "none",
            bodySize: 0,
            truncated: false,
            servedFromCache: !!details.fromCache
          }
        };
        try { this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null); } catch (e) {}
        this.reqMap.delete(details.requestId);
      } catch (e) {}
    };

    // register listeners with wide filter
    const filter = { urls: ["<all_urls>"] };
    try {
      browser.webRequest.onBeforeRequest.addListener(before, filter, ["requestBody"]);
      browser.webRequest.onHeadersReceived.addListener(onHeaders, filter, ["responseHeaders"]);
      browser.webRequest.onCompleted.addListener(onComplete, filter, ["responseHeaders"]);
      browser.webRequest.onErrorOccurred && browser.webRequest.onErrorOccurred.addListener((d)=>{ try{ onComplete(d); }catch{} }, filter);
      this._listeners.push({ fn: before, ev: browser.webRequest.onBeforeRequest });
      this._listeners.push({ fn: onHeaders, ev: browser.webRequest.onHeadersReceived });
      this._listeners.push({ fn: onComplete, ev: browser.webRequest.onCompleted });
    } catch (e) {
      // if permissions missing or API different, ignore
    }
  }

  async destroy() {
    if (!isFirefoxLike) return;
    try {
      // remove listeners by reloading extension or removing (best-effort)
      // webextension API doesn't expose removeListener by reference reliably in all cases here,
      // but we can attempt to clear them if needed.
      // For simplicity we clear the map
      this.reqMap.clear();
    } catch {}
  }
}

export { DeepCaptureFirefox, isFirefoxLike };

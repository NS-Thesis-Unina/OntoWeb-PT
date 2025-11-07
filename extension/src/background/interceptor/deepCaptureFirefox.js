// deepCaptureFirefox.js
// Deep capture for Firefox using webRequest + filterResponseData
// Exports: DeepCaptureFirefox, isFirefoxLike

const isFirefoxLike = typeof browser !== "undefined" && !!browser.webRequest && !!browser.webRequest.filterResponseData;

class DeepCaptureFirefox {
  constructor(onEntry) {
    this.onEntry = onEntry;
    this.reqMap = new Map();
    this._listeners = [];
    this._init();
  }

  _isHttp(u) { return typeof u === "string" && /^https?:/i.test(u); }

  _init() {
    if (!isFirefoxLike) return;

    const before = (details) => {
      try {
        if (!this._isHttp(details.url)) return; // filter non-http(s)
        this.reqMap.set(details.requestId, {
          url: details.url,
          method: details.method || "GET",
          ts: Date.now(),
          tabId: details.tabId ?? null,
          frameId: details.frameId ?? null,
          documentUrl: details.documentUrl || null,
          requestHeaders: {},
          requestBody: null
        });
        if (details.requestBody) {
          try {
            if (details.requestBody.formData) {
              const pairs = [];
              for (const k of Object.keys(details.requestBody.formData)) {
                for (const v of details.requestBody.formData[k]) pairs.push(`${k}=${v}`);
              }
              const txt = pairs.join("&");
              this.reqMap.get(details.requestId).requestBody = txt;
            } else if (details.requestBody.raw && details.requestBody.raw.length) {
              const raw = details.requestBody.raw[0];
              if (raw && raw.bytes) {
                const arr = new Uint8Array(raw.bytes);
                const dec = new TextDecoder();
                const text = dec.decode(arr);
                this.reqMap.get(details.requestId).requestBody = text;
              }
            }
          } catch {}
        }
      } catch {}
    };

    const onHeaders = (details) => {
      try {
        if (!this._isHttp(details.url)) return; // filter non-http(s)
        if (details?.requestId && typeof browser.webRequest.filterResponseData === "function") {
          try {
            const filter = browser.webRequest.filterResponseData(details.requestId);
            const chunks = [];
            filter.ondata = (event) => {
              try { chunks.push(event.data); } catch {}
              try { filter.write(event.data); } catch {}
            };
            filter.onstop = async () => {
              try {
                let totalLen = 0;
                for (const c of chunks) totalLen += c.byteLength;
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (const c of chunks) { merged.set(new Uint8Array(c), offset); offset += c.byteLength; }
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
                  let binary = "";
                  for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
                  body = btoa(binary);
                  bodyEncoding = "base64";
                }

                const reqMeta = this.reqMap.get(details.requestId) || {};
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
                    statusText: details.statusLine || "",
                    headers: headersObj,
                    body,
                    bodyEncoding,
                    bodySize: merged.length,
                    truncated: false
                  }
                };

                try { this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null); } catch {}
              } catch {} finally {
                try { filter.disconnect(); } catch {}
                this.reqMap.delete(details.requestId);
              }
            };
            filter.onerror = () => {
              try { filter.disconnect(); } catch {}
              this.reqMap.delete(details.requestId);
            };
          } catch {}
        }
      } catch {}
    };

    const onComplete = (details) => {
      try {
        if (!this._isHttp(details.url)) return; // filter non-http(s)
        const reqMeta = this.reqMap.get(details.requestId) || {};
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
        try { this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null); } catch {}
        this.reqMap.delete(details.requestId);
      } catch {}
    };

    const filter = { urls: ["<all_urls>"] };
    try {
      browser.webRequest.onBeforeRequest.addListener(before, filter, ["requestBody"]);
      browser.webRequest.onHeadersReceived.addListener(onHeaders, filter, ["responseHeaders"]);
      browser.webRequest.onCompleted.addListener(onComplete, filter, ["responseHeaders"]);
      browser.webRequest.onErrorOccurred && browser.webRequest.onErrorOccurred.addListener((d)=>{ try{ onComplete(d); }catch{} }, filter);
      this._listeners.push({ fn: before, ev: browser.webRequest.onBeforeRequest });
      this._listeners.push({ fn: onHeaders, ev: browser.webRequest.onHeadersReceived });
      this._listeners.push({ fn: onComplete, ev: browser.webRequest.onCompleted });
    } catch {}
  }

  async destroy() {
    if (!isFirefoxLike) return;
    try { this.reqMap.clear(); } catch {}
  }
}

export { DeepCaptureFirefox, isFirefoxLike };

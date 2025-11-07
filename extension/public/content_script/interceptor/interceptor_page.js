(function(){
  // Singleton controller installed once; supports dynamic reconfiguration
  if (!window.__owptInterceptor) {
    const Controller = (function(){
      const state = {
        flags: { types: { http: true, beacon: false, sse: false, websocket: false }, maxBodyBytes: 1024 * 1024 },
        installed: { fetch: false, xhr: false, beacon: false, sse: false, websocket: false },
        originals: { fetch: null, XMLHttpRequest: null, sendBeacon: null, EventSource: null, WebSocket: null }
      };

      const ALLOWED_METHODS = new Set(["GET","HEAD","POST","PUT","DELETE","CONNECT","OPTIONS","TRACE","PATCH"]);

      const BRIDGE_READY = { ready: false };
      window.addEventListener("message", (ev) => {
        if (ev?.data?.__owpt && ev?.data?.type === "owpt_bridge_ready") BRIDGE_READY.ready = true;
        if (ev?.data?.__owpt && ev?.data?.type === "owpt_update_flags") {
          try { applyFlags(window.__owptCaptureFlags || {}); } catch {}
        }
      });

      function isTextual(contentType = "") {
        const ct = String(contentType).toLowerCase();
        return (
          ct.startsWith("text/") ||
          ct.includes("application/json") ||
          ct.includes("application/xml") ||
          ct.includes("application/xhtml") ||
          ct.includes("application/javascript") ||
          ct.includes("application/x-www-form-urlencoded")
        );
      }

      function headersToObject(headers) {
        const obj = {};
        try { for (const [k, v] of headers.entries()) obj[String(k)] = String(v); } catch {}
        return obj;
      }

      async function readBodyAsBest(blobOrStream, contentType, maxBytes) {
        try {
          const buf = await (blobOrStream.arrayBuffer ? blobOrStream.arrayBuffer() : new Response(blobOrStream).arrayBuffer());
          const size = buf.byteLength;
          if (size === 0) return { body: null, bodySize: 0, encoding: "none", truncated: false };
          const truncated = size > maxBytes;
          const slice = truncated ? buf.slice(0, maxBytes) : buf;
          if (isTextual(contentType)) {
            const dec = new TextDecoder();
            const text = dec.decode(slice);
            return { body: text, bodySize: size, encoding: "text", truncated };
          } else {
            let binary = "";
            const bytes = new Uint8Array(slice);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const b64 = btoa(binary);
            return { body: b64, bodySize: size, encoding: "base64", truncated };
          }
        } catch (e) {
          return { body: null, bodySize: 0, encoding: "none", truncated: false, error: String(e?.message || e) };
        }
      }

      function post(payload) {
        try { window.postMessage({ __owpt: true, type: "owpt_intercept", payload }, "*"); } catch {}
      }

      // Validate method and normalize to UPPERCASE
      function normalizeMethod(m) {
        const mm = String(m || "GET").toUpperCase();
        return ALLOWED_METHODS.has(mm) ? mm : null;
      }

      // Resolve relative URL against location and ensure http/https
      function resolveHttpUrl(urlStr) {
        try {
          const abs = new URL(urlStr, location.href).toString();
          if (!/^https?:/i.test(abs)) return null;
          return abs;
        } catch { return null; }
      }

      function enableFetch(maxBytes) {
        if (state.installed.fetch) return;
        state.originals.fetch = window.fetch;
        window.fetch = async function(...args) {
          const startTs = Date.now();
          let url = "", method = "GET", reqHeaders = {};
          let reqBodyInfo = { body: null, bodySize: 0, encoding: "none", truncated: false };
          try {
            const req = new Request(...args);
            url = req.url; // already absolute
            method = normalizeMethod(req.method);
            if (!method) return state.originals.fetch.apply(this, args);
            if (!/^https?:/i.test(url)) return state.originals.fetch.apply(this, args);
            reqHeaders = headersToObject(req.headers);
            if (!["GET","HEAD"].includes(method)) {
              const clone = req.clone();
              const ctype = clone.headers.get("content-type") || "";
              const blob = await clone.blob();
              reqBodyInfo = await readBodyAsBest(blob, ctype, maxBytes);
            }
          } catch {
            // If we fail to normalize, fall back to native fetch without logging
            return state.originals.fetch.apply(this, args);
          }

          let response, resClone;
          try { response = await state.originals.fetch.apply(this, args); resClone = response.clone(); }
          catch (err) {
            post({ ts: startTs, pageUrl: location.href,
              request: { url, method, headers: reqHeaders, body: reqBodyInfo.body, bodyEncoding: reqBodyInfo.encoding, bodySize: reqBodyInfo.bodySize, truncated: reqBodyInfo.truncated },
              response: { networkError: String(err?.message || err) } });
            throw err;
          }

          try {
            const status = resClone.status, statusText = resClone.statusText || "";
            const resHeaders = headersToObject(resClone.headers);
            const rCType = resClone.headers.get("content-type") || "";
            const rBlob = await resClone.blob();
            const resBodyInfo = await readBodyAsBest(rBlob, rCType, maxBytes);

            post({ ts: startTs, pageUrl: location.href,
              request: { url, method, headers: reqHeaders, body: reqBodyInfo.body, bodyEncoding: reqBodyInfo.encoding, bodySize: reqBodyInfo.bodySize, truncated: reqBodyInfo.truncated },
              response: { status, statusText, headers: resHeaders, body: resBodyInfo.body, bodyEncoding: resBodyInfo.encoding, bodySize: resBodyInfo.bodySize, truncated: resBodyInfo.truncated }
            });
          } catch {}
          return response;
        };
        state.installed.fetch = true;
      }

      function disableFetch() {
        if (!state.installed.fetch) return;
        try { window.fetch = state.originals.fetch; } catch {}
        state.installed.fetch = false;
      }

      function enableXHR(maxBytes) {
        if (state.installed.xhr) return;
        state.originals.XMLHttpRequest = window.XMLHttpRequest;
        function XHRProxy() {
          const xhr = new state.originals.XMLHttpRequest();
          let _method = "GET", _url = "", _absUrl = "", _reqHeaders = {};
          let _reqBodyInfo = { body: null, bodySize: 0, encoding: "none", truncated: false };
          let _startTs = 0;

          const origOpen = xhr.open;
          xhr.open = function(method, url, ...rest) {
            const nm = normalizeMethod(method);
            const abs = resolveHttpUrl(url);
            _method = nm || "GET";
            _url = String(url || "");
            _absUrl = abs || "";       // only http/https is considered valid
            _reqHeaders = {};
            return origOpen.call(this, method, url, ...rest);
          };

          const origSetRequestHeader = xhr.setRequestHeader;
          xhr.setRequestHeader = function(k, v) {
            try { _reqHeaders[String(k)] = String(v); } catch {}
            return origSetRequestHeader.call(this, k, v);
          };

          const origSend = xhr.send;
          xhr.send = function(body) {
            // Skip capture if not conformant (non-http(s) or invalid method)
            if (!_absUrl || !ALLOWED_METHODS.has(_method)) {
              return origSend.call(this, body);
            }

            _startTs = Date.now();
            (async () => {
              try {
                if (body != null && !["GET","HEAD"].includes(_method)) {
                  if (typeof body === "string") {
                    const enc = new TextEncoder().encode(body);
                    const blob = new Blob([enc], { type: _reqHeaders["content-type"] || "text/plain" });
                    _reqBodyInfo = await readBodyAsBest(blob, _reqHeaders["content-type"] || "text/plain", maxBytes);
                  } else if (body instanceof Blob) {
                    _reqBodyInfo = await readBodyAsBest(body, body.type || (_reqHeaders["content-type"]||""), maxBytes);
                  } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
                    const blob = new Blob([body], { type: _reqHeaders["content-type"] || "" });
                    _reqBodyInfo = await readBodyAsBest(blob, _reqHeaders["content-type"] || "", maxBytes);
                  } else if (body instanceof FormData) {
                    const pairs = [];
                    for (const [k, v] of body.entries()) pairs.push(`${k}=${(v && v.name) ? `[file:${v.name}]` : String(v)}`);
                    const text = pairs.join("&");
                    const enc = new TextEncoder().encode(text);
                    const blob = new Blob([enc], { type: "application/x-www-form-urlencoded" });
                    _reqBodyInfo = await readBodyAsBest(blob, "application/x-www-form-urlencoded", maxBytes);
                  }
                }
              } catch {}
            })();

            this.addEventListener("load", async function () {
              try {
                const status = this.status, statusText = this.statusText || "";
                const hdrRaw = this.getAllResponseHeaders() || "";
                const headers = {};
                hdrRaw.split(/\r?\n/).forEach(line => {
                  const idx = line.indexOf(":");
                  if (idx > 0) { const k = line.slice(0, idx).trim(); const v = line.slice(idx + 1).trim(); if (k) headers[k.toLowerCase()] = v; }
                });
                let bodyBlob;
                try {
                  if (this.response instanceof Blob) bodyBlob = this.response;
                  else if (typeof this.response === "string") bodyBlob = new Blob([new TextEncoder().encode(this.response)], { type: headers["content-type"] || "text/plain" });
                  else if (this.response instanceof ArrayBuffer) bodyBlob = new Blob([this.response], { type: headers["content-type"] || "" });
                  else bodyBlob = new Blob([], { type: headers["content-type"] || "" });
                } catch { bodyBlob = new Blob([], { type: headers["content-type"] || "" }); }
                const resBodyInfo = await readBodyAsBest(bodyBlob, headers["content-type"] || "", maxBytes);

                post({ ts: _startTs, pageUrl: location.href,
                  request: { url: _absUrl, method: _method, headers: _reqHeaders, body: _reqBodyInfo.body, bodyEncoding: _reqBodyInfo.encoding, bodySize: _reqBodyInfo.bodySize, truncated: _reqBodyInfo.truncated },
                  response: { status, statusText, headers, body: resBodyInfo.body, bodyEncoding: resBodyInfo.encoding, bodySize: resBodyInfo.bodySize, truncated: resBodyInfo.truncated }
                });
              } catch {}
            });
            return origSend.call(this, body);
          };
          return xhr;
        }
        window.XMLHttpRequest = XHRProxy;
        state.installed.xhr = true;
      }

      function disableXHR() {
        if (!state.installed.xhr) return;
        try { window.XMLHttpRequest = state.originals.XMLHttpRequest; } catch {}
        state.installed.xhr = false;
      }

      function applyFlags(nextFlagsRaw) {
        const next = {
          types: {
            http: !!nextFlagsRaw?.types?.http,
            beacon: !!nextFlagsRaw?.types?.beacon,
            sse: !!nextFlagsRaw?.types?.sse,
            websocket: !!nextFlagsRaw?.types?.websocket
          },
          maxBodyBytes: Number(nextFlagsRaw?.maxBodyBytes) > 0 ? Number(nextFlagsRaw.maxBodyBytes) : state.flags.maxBodyBytes
        };
        state.flags = next;

        if (next.types.http) { enableFetch(state.flags.maxBodyBytes); enableXHR(state.flags.maxBodyBytes); }
        else { disableFetch(); disableXHR(); }
      }

      function installInitial() {
        try { applyFlags(window.__owptCaptureFlags || state.flags); } catch { applyFlags(state.flags); }
      }

      return { installInitial, applyFlags };
    })();

    window.__owptInterceptor = Controller;
    window.__owptInterceptor.installInitial();
  } else {
    try {
      window.__owptInterceptor.applyFlags(window.__owptCaptureFlags || {});
    } catch {}
  }
})();

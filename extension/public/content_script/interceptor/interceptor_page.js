(function(){
  if (window.__owptInterceptorInstalled) return;
  window.__owptInterceptorInstalled = true;

  const MAX_BODY_BYTES = 1024 * 1024; // 1MB
  const BRIDGE_READY = { ready: false };
  window.addEventListener("message", (ev) => {
    if (ev?.data?.__owpt && ev?.data?.type === "owpt_bridge_ready") BRIDGE_READY.ready = true;
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
  async function readBodyAsBest(blobOrStream, contentType, maxBytes = MAX_BODY_BYTES) {
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

  /* ----------------- FETCH ----------------- */
  const _origFetch = window.fetch;
  window.fetch = async function(...args) {
    const startTs = Date.now();
    let url = "", method = "GET", reqHeaders = {};
    let reqBodyInfo = { body: null, bodySize: 0, encoding: "none", truncated: false };
    try {
      const req = new Request(...args);
      url = req.url; method = req.method || "GET"; reqHeaders = headersToObject(req.headers);
      if (req.method && !["GET","HEAD"].includes(req.method.toUpperCase())) {
        const clone = req.clone();
        const ctype = clone.headers.get("content-type") || "";
        const blob = await clone.blob();
        reqBodyInfo = await readBodyAsBest(blob, ctype);
      }
    } catch {}

    let response, resClone;
    try { response = await _origFetch.apply(this, args); resClone = response.clone(); }
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
      const resBodyInfo = await readBodyAsBest(rBlob, rCType);

      post({ ts: startTs, pageUrl: location.href,
        request: { url, method, headers: reqHeaders, body: reqBodyInfo.body, bodyEncoding: reqBodyInfo.encoding, bodySize: reqBodyInfo.bodySize, truncated: reqBodyInfo.truncated },
        response: { status, statusText, headers: resHeaders, body: resBodyInfo.body, bodyEncoding: resBodyInfo.encoding, bodySize: resBodyInfo.bodySize, truncated: resBodyInfo.truncated }
      });
    } catch {}
    return response;
  };

  /* ----------------- XHR ----------------- */
  const _OrigXHR = window.XMLHttpRequest;
  function XHRProxy() {
    const xhr = new _OrigXHR();
    let _method = "GET", _url = "", _reqHeaders = {};
    let _reqBodyInfo = { body: null, bodySize: 0, encoding: "none", truncated: false };
    let _startTs = 0;

    const origOpen = xhr.open;
    xhr.open = function(method, url, ...rest) { _method = String(method||"GET"); _url = String(url||""); _reqHeaders = {}; return origOpen.call(this, method, url, ...rest); };
    const origSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(k, v) { try { _reqHeaders[String(k)] = String(v); } catch{} return origSetRequestHeader.call(this, k, v); };

    const origSend = xhr.send;
    xhr.send = function(body) {
      _startTs = Date.now();
      (async () => {
        try {
          if (body != null && _method && !["GET","HEAD"].includes(_method.toUpperCase())) {
            if (typeof body === "string") {
              const enc = new TextEncoder().encode(body);
              const blob = new Blob([enc], { type: _reqHeaders["content-type"] || "text/plain" });
              _reqBodyInfo = await readBodyAsBest(blob, _reqHeaders["content-type"] || "text/plain");
            } else if (body instanceof Blob) {
              _reqBodyInfo = await readBodyAsBest(body, body.type || (_reqHeaders["content-type"]||""));
            } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
              const blob = new Blob([body], { type: _reqHeaders["content-type"] || "" });
              _reqBodyInfo = await readBodyAsBest(blob, _reqHeaders["content-type"] || "");
            } else if (body instanceof FormData) {
              const pairs = [];
              for (const [k, v] of body.entries()) pairs.push(`${k}=${(v && v.name) ? `[file:${v.name}]` : String(v)}`);
              const text = pairs.join("&");
              const enc = new TextEncoder().encode(text);
              const blob = new Blob([enc], { type: "application/x-www-form-urlencoded" });
              _reqBodyInfo = await readBodyAsBest(blob, "application/x-www-form-urlencoded");
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
          const resBodyInfo = await readBodyAsBest(bodyBlob, headers["content-type"] || "");
          post({ ts: _startTs, pageUrl: location.href,
            request: { url: _url, method: _method, headers: _reqHeaders, body: _reqBodyInfo.body, bodyEncoding: _reqBodyInfo.encoding, bodySize: _reqBodyInfo.bodySize, truncated: _reqBodyInfo.truncated },
            response: { status, statusText, headers, body: resBodyInfo.body, bodyEncoding: resBodyInfo.encoding, bodySize: resBodyInfo.bodySize, truncated: resBodyInfo.truncated }
          });
        } catch {}
      });
      return origSend.call(this, body);
    };
    return xhr;
  }
  window.XMLHttpRequest = XHRProxy;

  /* ----------------- sendBeacon ----------------- */
  if (navigator && typeof navigator.sendBeacon === "function") {
    const _origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      const ts = Date.now();
      let bodyInfo = { body: null, bodySize: 0, encoding: "none", truncated: false };
      (async () => {
        try {
          if (typeof data === "string") {
            const enc = new TextEncoder().encode(data);
            const blob = new Blob([enc], { type: "text/plain" });
            bodyInfo = await readBodyAsBest(blob, "text/plain");
          } else if (data instanceof Blob) {
            bodyInfo = await readBodyAsBest(data, data.type || "");
          } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            const blob = new Blob([data], { type: "" });
            bodyInfo = await readBodyAsBest(blob, "");
          } else if (data instanceof FormData) {
            const pairs = [];
            for (const [k, v] of data.entries()) pairs.push(`${k}=${(v && v.name) ? `[file:${v.name}]` : String(v)}`);
            const text = pairs.join("&");
            const enc = new TextEncoder().encode(text);
            const blob = new Blob([enc], { type: "application/x-www-form-urlencoded" });
            bodyInfo = await readBodyAsBest(blob, "application/x-www-form-urlencoded");
          }
        } catch {}
        post({ ts, pageUrl: location.href,
          request: { url: String(url||""), method: "POST", headers: {}, body: bodyInfo.body, bodyEncoding: bodyInfo.encoding, bodySize: bodyInfo.bodySize, truncated: bodyInfo.truncated },
          response: { status: 0, statusText: "sendBeacon", headers: {}, body: null, bodyEncoding: "none", bodySize: 0, truncated: false }
        });
      })();
      return _origBeacon(url, data);
    };
  }

  /* ----------------- EventSource (SSE) ----------------- */
  const _OrigEventSource = window.EventSource;
  if (typeof _OrigEventSource === "function") {
    window.EventSource = function(url, init) {
      const es = new _OrigEventSource(url, init);
      const pageUrl = location.href;
      const startedTs = Date.now();
      es.addEventListener("message", (evt) => {
        try {
          const text = String(evt?.data ?? "");
          // non ha headers/HTTP status qui; logghiamo come stream
          post({ ts: startedTs, pageUrl,
            request: { url: String(url||""), method: "GET", headers: {}, body: null, bodyEncoding: "none", bodySize: 0, truncated: false },
            response: { status: 200, statusText: "EventSource", headers: {}, body: text, bodyEncoding: "text", bodySize: text.length, truncated: false }
          });
        } catch {}
      });
      return es;
    };
    window.EventSource.prototype = _OrigEventSource.prototype;
  }

  /* ----------------- WebSocket ----------------- */
  const _OrigWS = window.WebSocket;
  if (typeof _OrigWS === "function") {
    window.WebSocket = function(url, protocols) {
      const ws = new _OrigWS(url, protocols);
      const pageUrl = location.href;
      ws.addEventListener("message", (evt) => {
        try {
          let body = null, encoding = "none", size = 0;
          if (typeof evt.data === "string") { body = evt.data; encoding = "text"; size = body.length; }
          else if (evt.data instanceof Blob) { size = evt.data.size; encoding = "base64"; body = null; /* troppo costoso decodificarla sempre */ }
          post({ ts: Date.now(), pageUrl,
            request: { url: String(url||""), method: "WS", headers: {}, body: null, bodyEncoding: "none", bodySize: 0, truncated: false },
            response: { status: 101, statusText: "WebSocket Message", headers: {}, body, bodyEncoding: encoding, bodySize: size, truncated: false }
          });
        } catch {}
      });
      const _send = ws.send.bind(ws);
      ws.send = function(data) {
        try {
          let body = null, encoding = "none", size = 0;
          if (typeof data === "string") { body = data; encoding = "text"; size = data.length; }
          else if (data instanceof Blob) { size = data.size; encoding = "base64"; body = null; }
          post({ ts: Date.now(), pageUrl,
            request: { url: String(url||""), method: "WS_SEND", headers: {}, body, bodyEncoding: encoding, bodySize: size, truncated: false },
            response: { status: 101, statusText: "WebSocket Send", headers: {}, body: null, bodyEncoding: "none", bodySize: 0, truncated: false }
          });
        } catch {}
        return _send(data);
      };
      return ws;
    };
    window.WebSocket.prototype = _OrigWS.prototype;
  }
})();

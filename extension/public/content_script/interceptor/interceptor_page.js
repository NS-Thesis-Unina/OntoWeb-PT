/**
 * Interceptor Page Script
 *
 * Architectural Role:
 *   background (InterceptorEngine)
 *     → content_script/interceptor_injected.js
 *       → **interceptor_page.js** (this file, runs *inside page context*)
 *
 * Responsibilities:
 *   - Install network interception overrides on the page:
 *        • fetch()
 *        • XMLHttpRequest
 *        • sendBeacon()
 *        • (optionally SSE + WebSocket in future versions)
 *
 *   - Read flags injected into page (window.__owptCaptureFlags)
 *   - Dynamically enable/disable features based on updated flags
 *   - Forward captured request/response pairs to the extension via postMessage
 *   - Ensure low overhead and no disruption to application behavior
 *
 * Notes:
 *   - Runs in page context, not extension context.
 *   - Uses window.postMessage → intercepted by interceptor_injected.js.
 *   - Must be safe, robust, and minimally invasive.
 */

(function () {
  // ---------------------------------------------------------------------------
  //                         Singleton Initialization
  // ---------------------------------------------------------------------------

  // Prevent double installation. If already installed → only apply new flags.
  if (!window.__owptInterceptor) {
    const Controller = (function () {
      // -------------------------------------------------------------
      // Internal state (flags, installed hooks, originals)
      // -------------------------------------------------------------
      const state = {
        flags: {
          types: { http: true, beacon: false, sse: false, websocket: false },
          maxBodyBytes: 1024 * 1024,
        },
        installed: {
          fetch: false,
          xhr: false,
          beacon: false,
          sse: false,
          websocket: false,
        },
        originals: {
          fetch: null,
          XMLHttpRequest: null,
          sendBeacon: null,
          EventSource: null,
          WebSocket: null,
        },
      };

      // Supported HTTP methods
      const ALLOWED_METHODS = new Set([
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'DELETE',
        'CONNECT',
        'OPTIONS',
        'TRACE',
        'PATCH',
      ]);

      // Bridge readiness tracker (sync with injected script)
      const BRIDGE_READY = { ready: false };

      // Listen for bridge-ready + flag-update events from injected script
      window.addEventListener('message', (ev) => {
        if (ev?.data?.__owpt && ev.data.type === 'owpt_bridge_ready') {
          BRIDGE_READY.ready = true;
        }
        if (ev?.data?.__owpt && ev.data.type === 'owpt_update_flags') {
          try {
            applyFlags(window.__owptCaptureFlags || {});
          } catch {}
        }
      });

      // ---------------------------------------------------------------------
      //                         Utility Helpers
      // ---------------------------------------------------------------------

      /** Detect textual vs binary bodies. */
      function isTextual(contentType = '') {
        const ct = String(contentType).toLowerCase();
        return (
          ct.startsWith('text/') ||
          ct.includes('application/json') ||
          ct.includes('application/xml') ||
          ct.includes('application/xhtml') ||
          ct.includes('application/javascript') ||
          ct.includes('application/x-www-form-urlencoded')
        );
      }

      /** Convert Headers object to plain object. */
      function headersToObject(headers) {
        const obj = {};
        try {
          for (const [k, v] of headers.entries()) obj[String(k)] = String(v);
        } catch {}
        return obj;
      }

      /**
       * Unified body reader: supports Blob, FormData, ArrayBuffer, streams.
       * Automatically applies maxBodyBytes and textual/binary handling.
       */
      async function readBodyAsBest(blobOrStream, contentType, maxBytes) {
        try {
          const buf = await (blobOrStream.arrayBuffer
            ? blobOrStream.arrayBuffer()
            : new Response(blobOrStream).arrayBuffer());

          const size = buf.byteLength;
          if (size === 0) return { body: null, bodySize: 0, encoding: 'none', truncated: false };

          const truncated = size > maxBytes;
          const slice = truncated ? buf.slice(0, maxBytes) : buf;

          if (isTextual(contentType)) {
            const dec = new TextDecoder();
            const text = dec.decode(slice);
            return {
              body: text,
              bodySize: size,
              encoding: 'text',
              truncated,
            };
          } else {
            let binary = '';
            const bytes = new Uint8Array(slice);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            return {
              body: btoa(binary),
              bodySize: size,
              encoding: 'base64',
              truncated,
            };
          }
        } catch (e) {
          return {
            body: null,
            bodySize: 0,
            encoding: 'none',
            truncated: false,
            error: String(e?.message || e),
          };
        }
      }

      /** Forward captured events to extension (interceptor_injected.js). */
      function post(payload) {
        try {
          window.postMessage({ __owpt: true, type: 'owpt_intercept', payload }, '*');
        } catch {}
      }

      /** Normalize HTTP method to uppercase if valid. */
      function normalizeMethod(m) {
        const mm = String(m || 'GET').toUpperCase();
        return ALLOWED_METHODS.has(mm) ? mm : null;
      }

      /** Resolve relative URL → absolute, ensure HTTP/HTTPS. */
      function resolveHttpUrl(urlStr) {
        try {
          const abs = new URL(urlStr, location.href).toString();
          if (!/^https?:/i.test(abs)) return null;
          return abs;
        } catch {
          return null;
        }
      }

      // ---------------------------------------------------------------------
      //                         FETCH Interception
      // ---------------------------------------------------------------------

      function enableFetch(maxBytes) {
        if (state.installed.fetch) return;

        state.originals.fetch = window.fetch;

        window.fetch = async function (...args) {
          const startTs = Date.now();
          let url = '',
            method = 'GET',
            reqHeaders = {};
          let reqBodyInfo = {
            body: null,
            bodySize: 0,
            encoding: 'none',
            truncated: false,
          };

          // Capture request
          try {
            const req = new Request(...args);
            url = req.url;
            method = normalizeMethod(req.method);
            if (!method) return state.originals.fetch.apply(this, args);
            if (!/^https?:/i.test(url)) return state.originals.fetch.apply(this, args);

            reqHeaders = headersToObject(req.headers);

            if (!['GET', 'HEAD'].includes(method)) {
              const clone = req.clone();
              const ctype = clone.headers.get('content-type') || '';
              const blob = await clone.blob();
              reqBodyInfo = await readBodyAsBest(blob, ctype, maxBytes);
            }
          } catch {
            return state.originals.fetch.apply(this, args);
          }

          // Perform request
          let response, resClone;
          try {
            response = await state.originals.fetch.apply(this, args);
            resClone = response.clone();
          } catch (err) {
            post({
              ts: startTs,
              pageUrl: location.href,
              request: {
                url,
                method,
                headers: reqHeaders,
                body: reqBodyInfo.body,
                bodyEncoding: reqBodyInfo.encoding,
                bodySize: reqBodyInfo.bodySize,
                truncated: reqBodyInfo.truncated,
              },
              response: { networkError: String(err?.message || err) },
            });
            throw err;
          }

          // Capture response
          try {
            const status = resClone.status;
            const statusText = resClone.statusText || '';
            const resHeaders = headersToObject(resClone.headers);
            const rCType = resClone.headers.get('content-type') || '';
            const blob = await resClone.blob();
            const resBodyInfo = await readBodyAsBest(blob, rCType, maxBytes);

            post({
              ts: startTs,
              pageUrl: location.href,
              request: {
                url,
                method,
                headers: reqHeaders,
                body: reqBodyInfo.body,
                bodyEncoding: reqBodyInfo.encoding,
                bodySize: reqBodyInfo.bodySize,
                truncated: reqBodyInfo.truncated,
              },
              response: {
                status,
                statusText,
                headers: resHeaders,
                body: resBodyInfo.body,
                bodyEncoding: resBodyInfo.encoding,
                bodySize: resBodyInfo.bodySize,
                truncated: resBodyInfo.truncated,
              },
            });
          } catch {}

          return response;
        };

        state.installed.fetch = true;
      }

      function disableFetch() {
        if (!state.installed.fetch) return;
        try {
          window.fetch = state.originals.fetch;
        } catch {}
        state.installed.fetch = false;
      }

      // ---------------------------------------------------------------------
      //                         XHR Interception
      // ---------------------------------------------------------------------

      function enableXHR(maxBytes) {
        if (state.installed.xhr) return;

        state.originals.XMLHttpRequest = window.XMLHttpRequest;

        function XHRProxy() {
          const xhr = new state.originals.XMLHttpRequest();

          let _method = 'GET',
            _url = '',
            _absUrl = '',
            _reqHeaders = {};
          let _reqBodyInfo = {
            body: null,
            bodySize: 0,
            encoding: 'none',
            truncated: false,
          };
          let _startTs = 0;

          // open()
          const origOpen = xhr.open;
          xhr.open = function (method, url, ...rest) {
            const nm = normalizeMethod(method);
            const abs = resolveHttpUrl(url);

            _method = nm || 'GET';
            _url = String(url || '');
            _absUrl = abs || '';
            _reqHeaders = {};
            return origOpen.call(this, method, url, ...rest);
          };

          // setRequestHeader()
          const origSetRequestHeader = xhr.setRequestHeader;
          xhr.setRequestHeader = function (k, v) {
            try {
              _reqHeaders[String(k)] = String(v);
            } catch {}
            return origSetRequestHeader.call(this, k, v);
          };

          // send()
          const origSend = xhr.send;
          xhr.send = function (body) {
            if (!_absUrl || !ALLOWED_METHODS.has(_method)) {
              return origSend.call(this, body);
            }

            _startTs = Date.now();

            // Capture request body
            (async () => {
              try {
                if (body != null && !['GET', 'HEAD'].includes(_method)) {
                  if (typeof body === 'string') {
                    const enc = new TextEncoder().encode(body);
                    const blob = new Blob([enc], {
                      type: _reqHeaders['content-type'] || 'text/plain',
                    });
                    _reqBodyInfo = await readBodyAsBest(
                      blob,
                      _reqHeaders['content-type'] || 'text/plain',
                      maxBytes
                    );
                  } else if (body instanceof Blob) {
                    _reqBodyInfo = await readBodyAsBest(
                      body,
                      body.type || _reqHeaders['content-type'] || '',
                      maxBytes
                    );
                  } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
                    const blob = new Blob([body], {
                      type: _reqHeaders['content-type'] || '',
                    });
                    _reqBodyInfo = await readBodyAsBest(
                      blob,
                      _reqHeaders['content-type'] || '',
                      maxBytes
                    );
                  } else if (body instanceof FormData) {
                    const pairs = [];
                    for (const [k, v] of body.entries()) {
                      pairs.push(`${k}=${v && v.name ? `[file:${v.name}]` : String(v)}`);
                    }
                    const text = pairs.join('&');
                    const enc = new TextEncoder().encode(text);
                    const blob = new Blob([enc], {
                      type: 'application/x-www-form-urlencoded',
                    });
                    _reqBodyInfo = await readBodyAsBest(
                      blob,
                      'application/x-www-form-urlencoded',
                      maxBytes
                    );
                  }
                }
              } catch {}
            })();

            // Response capture via load event
            this.addEventListener('load', async function () {
              try {
                const status = this.status;
                const statusText = this.statusText || '';

                const hdrRaw = this.getAllResponseHeaders() || '';
                const headers = {};
                hdrRaw.split(/\r?\n/).forEach((line) => {
                  const idx = line.indexOf(':');
                  if (idx > 0) {
                    const k = line.slice(0, idx).trim().toLowerCase();
                    const v = line.slice(idx + 1).trim();
                    if (k) headers[k] = v;
                  }
                });

                let bodyBlob;
                try {
                  if (this.response instanceof Blob) {
                    bodyBlob = this.response;
                  } else if (typeof this.response === 'string') {
                    bodyBlob = new Blob([new TextEncoder().encode(this.response)], {
                      type: headers['content-type'] || 'text/plain',
                    });
                  } else if (this.response instanceof ArrayBuffer) {
                    bodyBlob = new Blob([this.response], {
                      type: headers['content-type'] || '',
                    });
                  } else {
                    bodyBlob = new Blob([], {
                      type: headers['content-type'] || '',
                    });
                  }
                } catch {
                  bodyBlob = new Blob([], { type: headers['content-type'] || '' });
                }

                const resBodyInfo = await readBodyAsBest(
                  bodyBlob,
                  headers['content-type'] || '',
                  maxBytes
                );

                post({
                  ts: _startTs,
                  pageUrl: location.href,
                  request: {
                    url: _absUrl,
                    method: _method,
                    headers: _reqHeaders,
                    body: _reqBodyInfo.body,
                    bodyEncoding: _reqBodyInfo.encoding,
                    bodySize: _reqBodyInfo.bodySize,
                    truncated: _reqBodyInfo.truncated,
                  },
                  response: {
                    status,
                    statusText,
                    headers,
                    body: resBodyInfo.body,
                    bodyEncoding: resBodyInfo.encoding,
                    bodySize: resBodyInfo.bodySize,
                    truncated: resBodyInfo.truncated,
                  },
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
        try {
          window.XMLHttpRequest = state.originals.XMLHttpRequest;
        } catch {}
        state.installed.xhr = false;
      }

      // ---------------------------------------------------------------------
      //               Apply Flags (enable/disable components)
      // ---------------------------------------------------------------------

      function applyFlags(nextFlagsRaw) {
        const next = {
          types: {
            http: !!nextFlagsRaw?.types?.http,
            beacon: !!nextFlagsRaw?.types?.beacon,
            sse: !!nextFlagsRaw?.types?.sse,
            websocket: !!nextFlagsRaw?.types?.websocket,
          },
          maxBodyBytes:
            Number(nextFlagsRaw?.maxBodyBytes) > 0
              ? Number(nextFlagsRaw.maxBodyBytes)
              : state.flags.maxBodyBytes,
        };

        state.flags = next;

        if (next.types.http) {
          enableFetch(state.flags.maxBodyBytes);
          enableXHR(state.flags.maxBodyBytes);
        } else {
          disableFetch();
          disableXHR();
        }
      }

      // ---------------------------------------------------------------------
      //                    Install initial configuration
      // ---------------------------------------------------------------------

      function installInitial() {
        try {
          applyFlags(window.__owptCaptureFlags || state.flags);
        } catch {
          applyFlags(state.flags);
        }
      }

      return {
        installInitial,
        applyFlags,
      };
    })();

    // First-time installation
    window.__owptInterceptor = Controller;
    window.__owptInterceptor.installInitial();
  } else {
    // Already installed → only reapply updated flags
    try {
      window.__owptInterceptor.applyFlags(window.__owptCaptureFlags || {});
    } catch {}
  }
})();

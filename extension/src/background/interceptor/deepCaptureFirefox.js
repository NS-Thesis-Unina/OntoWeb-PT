const isFirefoxLike =
  typeof browser !== 'undefined' && !!browser.webRequest && !!browser.webRequest.filterResponseData;

/**
 * **DeepCaptureFirefox**
 *
 * Architectural Role:
 *   InterceptorEngine
 *     → DeepCaptureFirefox (this file)
 *       → browser.webRequest + filterResponseData
 *
 * Responsibilities:
 *   - Capture HTTP(S) requests/responses using Firefox WebRequest API
 *   - Extract request bodies (formData, raw)
 *   - Intercept response bodies using filterResponseData
 *   - Reconstruct full binary/text responses
 *   - Forward completed entries to InterceptorEngine via onEntry callback
 *
 * Notes:
 *   - Firefox architecture is different from Chrome's DevTools Protocol.
 *   - filterResponseData allows streaming interception of response bodies.
 */
class DeepCaptureFirefox {
  constructor(onEntry) {
    this.onEntry = onEntry;
    this.reqMap = new Map(); // requestId → metadata
    this._listeners = [];
    this._init();
  }

  // ============================================================================
  //                               HTTP Helper
  // ============================================================================

  _isHttp(url) {
    return typeof url === 'string' && /^https?:/i.test(url);
  }

  // ============================================================================
  //                        Listener Initialization
  // ============================================================================

  _init() {
    if (!isFirefoxLike) return;

    // --------------------------- Request Start ---------------------------
    const onBeforeRequest = (details) => {
      try {
        if (!this._isHttp(details.url)) return;

        this.reqMap.set(details.requestId, {
          url: details.url,
          method: details.method || 'GET',
          ts: Date.now(),
          tabId: details.tabId ?? null,
          frameId: details.frameId ?? null,
          documentUrl: details.documentUrl || null,
          requestHeaders: {},
          requestBody: null,
        });

        // Extract request body (formData or raw bytes)
        if (details.requestBody) {
          try {
            if (details.requestBody.formData) {
              const pairs = [];
              for (const k of Object.keys(details.requestBody.formData)) {
                for (const v of details.requestBody.formData[k]) {
                  pairs.push(`${k}=${v}`);
                }
              }
              this.reqMap.get(details.requestId).requestBody = pairs.join('&');
            } else if (details.requestBody.raw && details.requestBody.raw.length) {
              const raw = details.requestBody.raw[0];
              if (raw?.bytes) {
                const arr = new Uint8Array(raw.bytes);
                const text = new TextDecoder().decode(arr);
                this.reqMap.get(details.requestId).requestBody = text;
              }
            }
          } catch {}
        }
      } catch {}
    };

    // ------------------------ Response Streaming ------------------------
    const onHeadersReceived = (details) => {
      try {
        if (!this._isHttp(details.url)) return;

        if (details?.requestId && typeof browser.webRequest.filterResponseData === 'function') {
          const filter = browser.webRequest.filterResponseData(details.requestId);
          const chunks = [];

          filter.ondata = (event) => {
            try {
              chunks.push(event.data);
            } catch {}
            try {
              filter.write(event.data);
            } catch {}
          };

          // Finalize body on stop
          filter.onstop = async () => {
            try {
              // Merge all binary chunks
              let total = 0;
              for (const c of chunks) total += c.byteLength;

              const merged = new Uint8Array(total);
              let offset = 0;
              for (const c of chunks) {
                merged.set(new Uint8Array(c), offset);
                offset += c.byteLength;
              }

              // Reconstruct body (text or base64)
              const contentType =
                (details.responseHeaders || []).find(
                  (h) => String(h.name).toLowerCase() === 'content-type'
                )?.value || '';

              let body = null;
              let bodyEncoding = 'none';

              const isText =
                /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded))/i.test(
                  contentType
                ) || contentType === '';

              if (isText) {
                try {
                  body = new TextDecoder().decode(merged);
                  bodyEncoding = 'text';
                } catch {
                  body = null;
                }
              } else {
                // Encode binary to base64
                let binary = '';
                for (let i = 0; i < merged.length; i++) {
                  binary += String.fromCharCode(merged[i]);
                }
                body = btoa(binary);
                bodyEncoding = 'base64';
              }

              // Build request metadata
              const reqMeta = this.reqMap.get(details.requestId) || {};

              const headersObj = {};
              try {
                for (const h of details.responseHeaders || []) {
                  headersObj[String(h.name)] = String(h.value);
                }
              } catch {}

              // Construct entry
              const entry = {
                meta: {
                  ts: reqMeta.ts || Date.now(),
                  tabId: reqMeta.tabId ?? null,
                  pageUrl: reqMeta.documentUrl || null,
                  frameId: reqMeta.frameId ?? null,
                },
                request: {
                  url: reqMeta.url || details.url,
                  method: reqMeta.method || 'GET',
                  headers: reqMeta.requestHeaders || {},
                  body: reqMeta.requestBody || null,
                  bodyEncoding: reqMeta.requestBody ? 'text' : 'none',
                  bodySize: reqMeta.requestBody ? String(reqMeta.requestBody).length : 0,
                  truncated: false,
                },
                response: {
                  status: details.statusCode || 0,
                  statusText: details.statusLine || '',
                  headers: headersObj,
                  body,
                  bodyEncoding,
                  bodySize: merged.length,
                  truncated: false,
                },
              };

              try {
                this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null);
              } catch {}
            } catch {
            } finally {
              try {
                filter.disconnect();
              } catch {}
              this.reqMap.delete(details.requestId);
            }
          };

          filter.onerror = () => {
            try {
              filter.disconnect();
            } catch {}
            this.reqMap.delete(details.requestId);
          };
        }
      } catch {}
    };

    // ------------------------- Response Without Body ------------------------
    const onCompleted = (details) => {
      try {
        if (!this._isHttp(details.url)) return;

        const reqMeta = this.reqMap.get(details.requestId) || {};

        const headersObj = {};
        try {
          for (const h of details.responseHeaders || []) {
            headersObj[String(h.name)] = String(h.value);
          }
        } catch {}

        const entry = {
          meta: {
            ts: reqMeta.ts || Date.now(),
            tabId: reqMeta.tabId ?? null,
            pageUrl: reqMeta.documentUrl || null,
            frameId: reqMeta.frameId ?? null,
          },
          request: {
            url: reqMeta.url || details.url,
            method: reqMeta.method || 'GET',
            headers: reqMeta.requestHeaders || {},
            body: reqMeta.requestBody || null,
            bodyEncoding: reqMeta.requestBody ? 'text' : 'none',
            bodySize: reqMeta.requestBody ? String(reqMeta.requestBody).length : 0,
            truncated: false,
          },
          response: {
            status: details.statusCode || 0,
            statusText: '',
            headers: headersObj,
            body: null,
            bodyEncoding: 'none',
            bodySize: 0,
            truncated: false,
            servedFromCache: !!details.fromCache,
          },
        };

        try {
          this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null);
        } catch {}
        this.reqMap.delete(details.requestId);
      } catch {}
    };

    // ----------------------------- Listener Registration -----------------------------
    const filter = { urls: ['<all_urls>'] };

    try {
      browser.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter, ['requestBody']);
      browser.webRequest.onHeadersReceived.addListener(onHeadersReceived, filter, [
        'responseHeaders',
      ]);
      browser.webRequest.onCompleted.addListener(onCompleted, filter, ['responseHeaders']);

      // Error → treat like completed (best effort)
      browser.webRequest.onErrorOccurred?.addListener((d) => {
        try {
          onCompleted(d);
        } catch {}
      }, filter);

      this._listeners.push({ ev: browser.webRequest.onBeforeRequest, fn: onBeforeRequest });
      this._listeners.push({ ev: browser.webRequest.onHeadersReceived, fn: onHeadersReceived });
      this._listeners.push({ ev: browser.webRequest.onCompleted, fn: onCompleted });
    } catch {}
  }

  // ============================================================================
  //                                  Destroy
  // ============================================================================

  async destroy() {
    if (!isFirefoxLike) return;
    try {
      this.reqMap.clear();
    } catch {}
  }
}

export { DeepCaptureFirefox, isFirefoxLike };

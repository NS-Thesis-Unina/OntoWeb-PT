const isFirefoxLike =
  typeof browser !== 'undefined' && !!browser.webRequest && !!browser.webRequest.filterResponseData;

// Helper: merge header array into a plain object { name: value }
function headersArrayToObject(arr) {
  const out = {};
  if (!Array.isArray(arr)) return out;
  for (const h of arr) {
    if (!h || !h.name) continue;
    out[String(h.name)] = String(h.value ?? '');
  }
  return out;
}

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
 *   - Capture full request headers via onBeforeSendHeaders
 *   - Extract request bodies (formData, raw)
 *   - Intercept response bodies using filterResponseData
 *   - Reconstruct full binary/text responses
 *   - Forward completed entries to InterceptorEngine via onEntry callback
 *
 * Notes:
 *   - Firefox architecture is different from Chrome's DevTools Protocol
 *   - webRequest exposes raw on-wire headers (no CORS filtering)
 *   - filterResponseData allows streaming interception of response bodies
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
    // Captures URL, method, timing, tab/frame info and request body.
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
            const meta = this.reqMap.get(details.requestId);
            if (!meta) return;

            if (details.requestBody.formData) {
              const pairs = [];
              for (const k of Object.keys(details.requestBody.formData)) {
                for (const v of details.requestBody.formData[k]) {
                  pairs.push(`${k}=${v}`);
                }
              }
              meta.requestBody = pairs.join('&');
            } else if (details.requestBody.raw && details.requestBody.raw.length) {
              const raw = details.requestBody.raw[0];
              if (raw?.bytes) {
                const arr = new Uint8Array(raw.bytes);
                const text = new TextDecoder().decode(arr);
                meta.requestBody = text;
              }
            }

            this.reqMap.set(details.requestId, meta);
          } catch {
            // ignore body decode errors
          }
        }
      } catch {
        // ignore unexpected errors
      }
    };

    // ----------------------- Request Headers (full set) -----------------------
    // Captures raw request headers as they are sent on the wire.
    const onBeforeSendHeaders = (details) => {
      try {
        if (!this._isHttp(details.url)) return;
        const meta = this.reqMap.get(details.requestId);
        if (!meta) return;

        meta.requestHeaders = headersArrayToObject(details.requestHeaders || []);
        this.reqMap.set(details.requestId, meta);
      } catch {
        // ignore header parsing errors
      }
    };

    // ------------------------ Response Streaming ------------------------
    // Uses filterResponseData to stream and reconstruct the response body.
    const onHeadersReceived = (details) => {
      try {
        if (!this._isHttp(details.url)) return;

        if (details?.requestId && typeof browser.webRequest.filterResponseData === 'function') {
          const filter = browser.webRequest.filterResponseData(details.requestId);
          const chunks = [];

          filter.ondata = (event) => {
            try {
              chunks.push(event.data);
            } catch {
              // ignore accumulate errors
            }
            try {
              filter.write(event.data);
            } catch {
              // ignore write errors
            }
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
              } else if (merged.length) {
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

              const headersObj = headersArrayToObject(details.responseHeaders || []);

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
                  servedFromCache: !!details.fromCache,
                },
              };

              try {
                this.onEntry(entry, reqMeta.tabId ?? null, reqMeta.documentUrl || null);
              } catch {
                // ignore consumer errors
              }
            } catch {
              // ignore reconstruction errors
            } finally {
              try {
                filter.disconnect();
              } catch {
                // ignore disconnect errors
              }
              this.reqMap.delete(details.requestId);
            }
          };

          filter.onerror = () => {
            try {
              filter.disconnect();
            } catch {
              // ignore disconnect errors
            }
            this.reqMap.delete(details.requestId);
          };
        }
      } catch {
        // ignore unexpected errors
      }
    };

    // ------------------------- Response Without Body ------------------------
    // Fallback path: if filterResponseData didn't produce an entry,
    // emit a body-less entry on completion.
    const onCompleted = (details) => {
      try {
        if (!this._isHttp(details.url)) return;

        // If streaming path already handled this request, skip.
        if (!this.reqMap.has(details.requestId)) return;

        const reqMeta = this.reqMap.get(details.requestId) || {};

        const headersObj = headersArrayToObject(details.responseHeaders || []);

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
        } catch {
          // ignore consumer errors
        }
        this.reqMap.delete(details.requestId);
      } catch {
        // ignore unexpected errors
      }
    };

    // ----------------------------- Listener Registration -----------------------------
    const filter = { urls: ['<all_urls>'] };

    try {
      // Body + basic metadata
      browser.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter, ['requestBody']);

      // Full request headers (similar role to Chrome's requestWillBeSentExtraInfo)
      browser.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, filter, [
        'requestHeaders',
      ]);

      // Response headers + streaming body
      browser.webRequest.onHeadersReceived.addListener(onHeadersReceived, filter, [
        'responseHeaders',
      ]);

      // Completion fallback (no streaming / body)
      browser.webRequest.onCompleted.addListener(onCompleted, filter, ['responseHeaders']);

      // Error → treat like completed (best effort)
      browser.webRequest.onErrorOccurred?.addListener((d) => {
        try {
          onCompleted(d);
        } catch {
          // ignore
        }
      }, filter);

      this._listeners.push({ ev: browser.webRequest.onBeforeRequest, fn: onBeforeRequest });
      this._listeners.push({ ev: browser.webRequest.onBeforeSendHeaders, fn: onBeforeSendHeaders });
      this._listeners.push({ ev: browser.webRequest.onHeadersReceived, fn: onHeadersReceived });
      this._listeners.push({ ev: browser.webRequest.onCompleted, fn: onCompleted });
    } catch {
      // ignore listener registration errors
    }
  }

  // ============================================================================
  //                                  Destroy
  // ============================================================================

  async destroy() {
    if (!isFirefoxLike) return;
    try {
      this.reqMap.clear();
      // Note: listeners are left attached for the lifetime of the extension,
      // mirroring the original behavior.
    } catch {
      // ignore
    }
  }
}

export { DeepCaptureFirefox, isFirefoxLike };

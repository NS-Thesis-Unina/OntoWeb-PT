const isChromeLike = typeof chrome !== 'undefined' && !!chrome.debugger;

/**
 * Build a stable string key for a debugger session.
 * `source` is the DebuggerSession object passed to chrome.debugger.onEvent.
 */
function sessionKeyFromSource(source) {
  if (!source || typeof source.tabId !== 'number') return null;
  const sid = source.sessionId || 'root';
  return `${source.tabId}:${sid}`;
}

/**
 * Merge headers from `src` into `dst`, normalizing names/values to strings.
 * Supports both object form and array form [{ name, value }].
 */
function mergeHeaders(dst, src) {
  if (!src || typeof src !== 'object') return dst || {};
  const out = { ...(dst || {}) };

  if (Array.isArray(src)) {
    for (const h of src) {
      if (h && h.name) out[String(h.name)] = String(h.value ?? '');
    }
  } else {
    for (const [name, value] of Object.entries(src)) {
      out[String(name)] = String(value);
    }
  }

  return out;
}

/**
 * **DeepCaptureChrome**
 *
 * Architectural Role:
 *   InterceptorEngine
 *     → DeepCaptureChrome
 *       → chrome.debugger (Network.* events)
 *
 * Responsibilities:
 *   - Attach debugger sessions to tabs
 *   - Capture DevTools Protocol Network events (including *ExtraInfo*)
 *   - Merge high-level and raw on-wire request/response headers
 *   - Build normalized request/response entries (with optional body)
 *   - Forward completed entries to InterceptorEngine via onEntry callback
 *
 * Notes:
 *   - Chrome / Chromium-based only (requires chrome.debugger)
 *   - Firefox uses a different implementation (DeepCaptureFirefox)
 *   - Uses flat sessions (tabId + sessionId) to handle main frame, iframes and workers
 */
class DeepCaptureChrome {
  constructor(onEntry) {
    this.onEntry = onEntry; // function(entry, tabId, pageUrl)
    // Map<sessionKey, { debuggee: DebuggerSession, requests: Map<requestId, Rec> }>
    this.sessions = new Map();
    this.attachedTabs = new Set(); // Set<tabId>
    this._boundOnEvent = this._onEvent.bind(this);
    this._listening = false;
  }

  // ============================================================================
  //                               Public API
  // ============================================================================

  /**
   * Attach the debugger to the given tab and enable the Network domain.
   * Also configures auto-attach for iframes/workers via flat sessions.
   */
  async attachToTab(tabId) {
    if (!isChromeLike) return false;
    if (this.attachedTabs.has(tabId)) return true;

    return new Promise((resolve) => {
      chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
          console.warn('[DeepCaptureChrome] attach failed:', chrome.runtime.lastError.message);
          return resolve(false);
        }

        this.attachedTabs.add(tabId);

        const rootDebuggee = { tabId };

        // Enable Network domain on the root session (tab main frame)
        chrome.debugger.sendCommand(rootDebuggee, 'Network.enable', {}, () => {
          // Ask Chrome to auto-attach child targets (e.g. iframes) using flat sessions
          chrome.debugger.sendCommand(
            rootDebuggee,
            'Target.setAutoAttach',
            {
              autoAttach: true,
              waitForDebuggerOnStart: false,
              flatten: true,
              // At minimum track iframes; remove filter to attach to all sub-targets.
              filter: [{ type: 'iframe', exclude: false }],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.warn(
                  '[DeepCaptureChrome] Target.setAutoAttach failed:',
                  chrome.runtime.lastError.message
                );
              }

              // Register the global debugger event listener only once.
              if (!this._listening) {
                chrome.debugger.onEvent.addListener(this._boundOnEvent);
                this._listening = true;
              }

              resolve(true);
            }
          );
        });
      });
    });
  }

  /**
   * Detach the debugger from all tabs and clear all internal state.
   */
  async detachFromAll() {
    if (!isChromeLike) return;

    try {
      if (this._listening) {
        chrome.debugger.onEvent.removeListener(this._boundOnEvent);
        this._listening = false;
      }
    } catch (e) {
      console.warn('[DeepCaptureChrome] failed removing listener', e);
    }

    for (const tabId of Array.from(this.attachedTabs)) {
      try {
        chrome.debugger.detach({ tabId });
      } catch (e) {
        // ignore detach errors
      }
    }

    this.attachedTabs.clear();
    this.sessions.clear();
  }

  // ============================================================================
  //                        Session / Request bookkeeping
  // ============================================================================

  /**
   * Ensure there is a session state for the given debugger source and return it.
   */
  _ensureSessionForSource(source) {
    const key = sessionKeyFromSource(source);
    if (!key) return null;

    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        debuggee: { tabId: source.tabId, sessionId: source.sessionId },
        requests: new Map(),
      });

      // For child sessions (iframes/workers) we need to explicitly enable Network.
      if (source.sessionId) {
        try {
          chrome.debugger.sendCommand(
            { tabId: source.tabId, sessionId: source.sessionId },
            'Network.enable',
            {}
          );
        } catch (e) {
          console.warn('[DeepCaptureChrome] Network.enable for child session failed:', e);
        }
      }
    }

    return this.sessions.get(key);
  }

  /**
   * Return the tracking record for `requestId`, initializing it if missing.
   */
  _getOrInitRequest(store, requestId) {
    if (!store.has(requestId)) {
      store.set(requestId, {
        ts: Date.now(),
        url: '',
        method: 'GET',
        documentURL: null,
        frameId: null,
        requestBody: null,
        requestHeaders: {},
        responseHeaders: {},
        status: undefined,
        statusText: '',
        mimeType: '',
        servedFromCache: false,
        fromServiceWorker: false,
        timing: null,
      });
    }
    return store.get(requestId);
  }

  /**
   * Check if the URL is HTTP/HTTPS (i.e. relevant for our capture).
   */
  _isHttp(url) {
    return typeof url === 'string' && /^https?:/i.test(url);
  }

  // ============================================================================
  //                         Chrome Debugger Event Handler
  // ============================================================================

  /**
   * Main handler registered on chrome.debugger.onEvent.
   * Normalizes Network.* events into our request/response model.
   */
  _onEvent(source, method, params = {}) {
    const tabId = source?.tabId;
    if (typeof tabId !== 'number') return;

    // New target (e.g. iframe) auto-attached → create child session and enable Network.
    if (method === 'Target.attachedToTarget') {
      const childSessionId = params?.sessionId;
      if (!childSessionId) return;

      const childDebuggee = { tabId, sessionId: childSessionId };
      const key = sessionKeyFromSource(childDebuggee);
      if (!key) return;

      if (!this.sessions.has(key)) {
        this.sessions.set(key, { debuggee: childDebuggee, requests: new Map() });
      }

      try {
        chrome.debugger.sendCommand(childDebuggee, 'Network.enable', {});
      } catch (e) {
        console.warn('[DeepCaptureChrome] Network.enable (attachedToTarget) failed:', e);
      }

      return;
    }

    const session = this._ensureSessionForSource(source);
    if (!session) return;
    const store = session.requests;

    switch (method) {
      // -------------------------- Request start (renderer view) --------------
      case 'Network.requestWillBeSent': {
        const { requestId, request, documentURL, frameId } = params;
        if (!requestId || !request) return;
        if (!this._isHttp(request.url)) return;

        const rec = this._getOrInitRequest(store, requestId);
        rec.ts = rec.ts || Date.now();
        rec.url = request.url || rec.url || '';
        rec.method = request.method || rec.method || 'GET';
        rec.documentURL = documentURL || rec.documentURL || null;
        rec.frameId = frameId || rec.frameId || null;
        rec.requestBody = request.postData ?? rec.requestBody;
        rec.requestHeaders = mergeHeaders(rec.requestHeaders, request.headers || {});
        break;
      }

      // ---------------------- Extra request info (raw on-wire headers) -------
      // Contains the raw request headers as they will actually be sent on the wire.
      case 'Network.requestWillBeSentExtraInfo': {
        const { requestId, headers } = params;
        if (!requestId || !headers) return;

        const rec = this._getOrInitRequest(store, requestId);
        rec.requestHeaders = mergeHeaders(rec.requestHeaders, headers);
        break;
      }

      // ----------------------------- Response metadata ------------------------
      case 'Network.responseReceived': {
        const { requestId, response, frameId } = params;
        if (!requestId || !response) return;

        const rec = this._getOrInitRequest(store, requestId);
        rec.status = typeof response.status === 'number' ? response.status : rec.status;
        rec.statusText = response.statusText || rec.statusText || '';
        rec.responseHeaders = mergeHeaders(rec.responseHeaders, response.headers || {});
        rec.mimeType = response.mimeType || rec.mimeType || '';
        rec.fromServiceWorker = !!response.fromServiceWorker;
        rec.timing = response.timing || rec.timing || null;
        rec.frameId = frameId || rec.frameId || null;

        if (typeof response.fromDiskCache === 'boolean') {
          rec.servedFromCache = rec.servedFromCache || response.fromDiskCache;
        }
        if (typeof response.fromServiceWorker === 'boolean') {
          rec.fromServiceWorker = response.fromServiceWorker;
        }
        break;
      }

      // ---------------------- Extra response info (raw on-wire headers) ------
      case 'Network.responseReceivedExtraInfo': {
        const { requestId, headers, statusCode } = params;
        if (!requestId || !headers) return;

        const rec = this._getOrInitRequest(store, requestId);
        rec.responseHeaders = mergeHeaders(rec.responseHeaders, headers);
        if (typeof statusCode === 'number') {
          rec.status = statusCode;
        }
        break;
      }

      // -------------------------- Request served from cache ------------------
      case 'Network.requestServedFromCache': {
        const { requestId } = params;
        if (!requestId) return;
        const rec = store.get(requestId);
        if (!rec) return;
        rec.servedFromCache = true;
        break;
      }

      // ------------------------------ Load failed ----------------------------
      case 'Network.loadingFailed': {
        const { requestId, errorText } = params;
        if (!requestId) return;
        const rec = store.get(requestId);
        if (!rec) return;

        const entry = {
          meta: {
            ts: rec.ts || Date.now(),
            tabId,
            pageUrl: rec.documentURL || null,
            frameId: rec.frameId || null,
          },
          request: {
            url: rec.url,
            method: rec.method || 'GET',
            headers: rec.requestHeaders || {},
            body: rec.requestBody || null,
            bodyEncoding: rec.requestBody ? 'text' : 'none',
            bodySize: rec.requestBody ? rec.requestBody.length : 0,
            truncated: false,
          },
          response: {
            networkError: String(errorText || 'loadingFailed'),
          },
        };

        try {
          this.onEntry(entry, tabId, rec.documentURL || null);
        } catch (e) {
          console.warn('[DeepCaptureChrome] onEntry (loadingFailed) threw:', e);
        } finally {
          store.delete(requestId);
        }

        break;
      }

      // ------------------------------ Load finished ---------------------------
      case 'Network.loadingFinished': {
        const { requestId } = params;
        if (!requestId) return;
        const rec = store.get(requestId);
        if (!rec) return;

        const debuggee = session.debuggee;

        // Finalizes the request: optionally fetches the body and builds the final entry.
        const finalize = (res) => {
          const body = res && typeof res.body === 'string' ? res.body : null;
          const base64Encoded = !!(res && res.base64Encoded);
          const encoding = base64Encoded ? 'base64' : body ? 'text' : 'none';

          let size = 0;
          if (body) {
            size = base64Encoded ? Math.ceil((body.length * 3) / 4) : body.length;
          }

          const entry = {
            meta: {
              ts: rec.ts || Date.now(),
              tabId,
              pageUrl: rec.documentURL || null,
              frameId: rec.frameId || null,
            },
            request: {
              url: rec.url,
              method: rec.method || 'GET',
              headers: rec.requestHeaders || {},
              body: rec.requestBody || null,
              bodyEncoding: rec.requestBody ? 'text' : 'none',
              bodySize: rec.requestBody ? rec.requestBody.length : 0,
              truncated: false,
            },
            response: {
              status: typeof rec.status === 'number' ? rec.status : 0,
              statusText: rec.statusText || '',
              headers: rec.responseHeaders || {},
              body,
              bodyEncoding: encoding,
              bodySize: size,
              truncated: false,
              servedFromCache: !!rec.servedFromCache,
              fromServiceWorker: !!rec.fromServiceWorker,
            },
          };

          try {
            this.onEntry(entry, tabId, rec.documentURL || null);
          } catch (e) {
            console.warn('[DeepCaptureChrome] onEntry (loadingFinished) threw:', e);
          } finally {
            store.delete(requestId);
          }
        };

        try {
          chrome.debugger.sendCommand(debuggee, 'Network.getResponseBody', { requestId }, (res) => {
            if (chrome.runtime.lastError) {
              // Some responses (large, cached, opaque, etc.) may not expose a readable body.
              finalize(null);
            } else {
              finalize(res);
            }
          });
        } catch (e) {
          console.warn('[DeepCaptureChrome] Network.getResponseBody failed:', e);
          finalize(null);
        }

        break;
      }

      default:
        // Other debugger events are not relevant for deep capture.
        break;
    }
  }
}

export { DeepCaptureChrome, isChromeLike };

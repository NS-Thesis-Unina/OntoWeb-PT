import React, { useEffect, useState, useCallback } from "react";
import techStackReactController from "../../../techstackController";

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e3e3e3", borderRadius: 6, padding: 8, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
           onClick={() => setOpen(v => !v)}>
        <strong>{title}</strong>
        <span style={{ opacity: 0.7 }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function KeyValueRow({ k, v }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "2px 0" }}>
      <div style={{ minWidth: 140, color: "#333", fontWeight: 600 }}>{k}:</div>
      <div style={{ flex: 1, color: "#111" }}>{v}</div>
    </div>
  );
}

export default function ScanTechStack() {
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [payload, setPayload] = useState(null); // shape: { meta, results } or null
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const tabId = await techStackReactController.getCurrentTabId();
        const res = await techStackReactController.loadLastAvailable(tabId);
        if (!mounted) return;
        setSource(res.source);
        setPayload(res.data);
      } catch (e) {
        console.warn("Load last techstack failed", e);
        setError("Errore nel caricamento dei risultati precedenti.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const unsub = techStackReactController.onMessage({
      onScanComplete: (p) => {
        // p expected: { meta, results }
        setSource("fresh");
        setPayload(p);
        setScanning(false);
      },
      onScanError: (msg) => {
        setError(msg || "Errore nella scansione TechStack");
        setScanning(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const startScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    const tabId = await techStackReactController.getCurrentTabId();
    techStackReactController.sendStartOneTimeStackScan(tabId);
  }, []);

  // Normalizza la forma del payload in { meta, results }
  const normalized = (() => {
    if (!payload) return null;
    if (payload.meta || payload.results) {
      // already in expected shape OR local storage format { meta, results }
      if (payload.results) return { meta: payload.meta ?? payload.results.meta ?? null, results: payload.results };
      return { meta: payload.meta ?? null, results: payload.results ?? null };
    }
    // If payload is just a results object (older shape), guess meta inside or null
    if (payload.technologies || payload.waf || payload.storage || payload.cookies || payload.raw) {
      return { meta: payload.meta ?? null, results: payload };
    }
    // If local returned something like { key, results } then payload may be that shape already handled earlier
    return payload;
  })();

  const renderTechnologies = (results) => (
    <div>
      <h4>Technologies</h4>
      {Array.isArray(results?.technologies) && results.technologies.length ? (
        <ul>
          {results.technologies.map((t, i) => (
            <li key={i}>{t.name}{t.version ? ` (${t.version})` : ""}</li>
          ))}
        </ul>
      ) : <div>Nessuna tecnologia rilevata</div>}
    </div>
  );

  const renderWaf = (results) => (
    <div>
      <h4>WAF / Proxy</h4>
      {Array.isArray(results?.waf) && results.waf.length ? (
        <ul>
          {results.waf.map((w, i) => <li key={i}>{w.name}{w.version ? ` (${w.version})` : ""}</li>)}
        </ul>
      ) : <div>Nessun WAF rilevato</div>}
    </div>
  );

  const renderSecureHeaders = (results) => (
    <div>
      <h4>Secure headers findings</h4>
      {Array.isArray(results?.secureHeaders) && results.secureHeaders.length ? (
        results.secureHeaders.map((f, i) => (
          <div key={i} style={{ marginBottom: 6, padding: 6, border: "1px dashed #ddd", borderRadius: 4 }}>
            <div style={{ fontWeight: 700 }}>{f.header}</div>
            <div style={{ marginTop: 4 }}>{f.description}</div>
            {Array.isArray(f.urls) && f.urls.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary>URLs interessate ({f.urls.length})</summary>
                <ul>
                  {f.urls.map((u, j) => <li key={j} style={{ fontSize: 13 }}>{u}</li>)}
                </ul>
              </details>
            )}
          </div>
        ))
      ) : <div>Nessuna anomalia rilevata nelle secure headers</div>}
    </div>
  );

  const renderCookies = (results) => (
    <div>
      <h4>Cookies</h4>
      {Array.isArray(results?.cookies) && results.cookies.length ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>Domain</th>
              <th style={{ textAlign: "left", padding: 6 }}>Name</th>
              <th style={{ textAlign: "left", padding: 6 }}>Value (truncated)</th>
              <th style={{ textAlign: "left", padding: 6 }}>HttpOnly</th>
            </tr>
          </thead>
          <tbody>
            {results.cookies.map((c, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={{ padding: 6 }}>{c.domain}</td>
                <td style={{ padding: 6 }}>{c.name}</td>
                <td style={{ padding: 6, fontFamily: "monospace" }}>{String(c.value).slice(0, 120)}</td>
                <td style={{ padding: 6 }}>{c.httpOnly ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div>Nessun cookie rilevato</div>}
    </div>
  );

  const renderStorage = (results) => (
    <div>
      <h4>Storage (Local / Session)</h4>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <strong>LocalStorage ({Array.isArray(results?.storage?.localStorage) ? results.storage.localStorage.length : 0})</strong>
          <div style={{ maxHeight: 200, overflow: "auto", padding: 6, border: "1px solid #eee", marginTop: 6, background: "#fafafa" }}>
            {Array.isArray(results?.storage?.localStorage) && results.storage.localStorage.length ? (
              <ul style={{ fontFamily: "monospace", fontSize: 13 }}>
                {results.storage.localStorage.map((it, idx) => <li key={idx}><code>{String(it).slice(0, 500)}</code></li>)}
              </ul>
            ) : <div style={{ color: "#666" }}>vuoto</div>}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <strong>SessionStorage ({Array.isArray(results?.storage?.sessionStorage) ? results.storage.sessionStorage.length : 0})</strong>
          <div style={{ maxHeight: 200, overflow: "auto", padding: 6, border: "1px solid #eee", marginTop: 6, background: "#fafafa" }}>
            {Array.isArray(results?.storage?.sessionStorage) && results.storage.sessionStorage.length ? (
              <ul style={{ fontFamily: "monospace", fontSize: 13 }}>
                {results.storage.sessionStorage.map((it, idx) => <li key={idx}><code>{String(it).slice(0, 500)}</code></li>)}
              </ul>
            ) : <div style={{ color: "#666" }}>vuoto</div>}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRawResolved = (results) => (
    <div>
      <h4>Raw resolved (brief)</h4>
      {results?.raw?.resolved ? (
        <div style={{ maxHeight: 220, overflow: "auto", padding: 8, border: "1px solid #eee", background: "#fff" }}>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(results.raw.resolved, null, 2).slice(0, 30_000)}</pre>
        </div>
      ) : <div>N/D</div>}
    </div>
  );

  const renderFullJson = (obj) => (
    <div>
      <h4>Dump JSON completo</h4>
      <div style={{ maxHeight: 320, overflow: "auto", padding: 8, border: "1px solid #ddd", background: "#fafafa" }}>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(obj, null, 2)}</pre>
      </div>
    </div>
  );

  const renderSummary = () => {
    if (!normalized) {
      return <div className="empty">Nessun risultato disponibile</div>;
    }

    const { meta, results } = normalized;

    return (
      <div>
        <Collapsible title="Meta (panoramica)" defaultOpen={true}>
          <KeyValueRow k="URL" v={meta?.url ?? "-"} />
          <KeyValueRow k="TabId" v={meta?.tabId ?? "-"} />
          <KeyValueRow k="Timestamp" v={meta?.timestamp ? new Date(meta.timestamp).toLocaleString() : "-"} />
          <KeyValueRow k="Origine caricamento" v={source ?? "-"} />
        </Collapsible>

        <Collapsible title={`Technologies (${Array.isArray(results?.technologies) ? results.technologies.length : 0})`} defaultOpen>
          {renderTechnologies(results)}
        </Collapsible>

        <Collapsible title={`WAF (${Array.isArray(results?.waf) ? results.waf.length : 0})`}>
          {renderWaf(results)}
        </Collapsible>

        <Collapsible title={`Secure Headers (${Array.isArray(results?.secureHeaders) ? results.secureHeaders.length : 0})`}>
          {renderSecureHeaders(results)}
        </Collapsible>

        <Collapsible title={`Cookies (${Array.isArray(results?.cookies) ? results.cookies.length : 0})`}>
          {renderCookies(results)}
        </Collapsible>

        <Collapsible title="Storage (dettaglio)">
          {renderStorage(results)}
        </Collapsible>

        <Collapsible title="Raw resolved e dettagli Wappalyzer (preview)">
          {renderRawResolved(results)}
        </Collapsible>

        <Collapsible title="JSON completo (downloadable / copia)">
          {renderFullJson({ meta, results })}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => {
              try {
                const blob = new Blob([JSON.stringify({ meta, results }, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `techstack_${meta?.timestamp || Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch (e) {
                console.warn("Export failed", e);
              }
            }}>Esporta JSON</button>
          </div>
        </Collapsible>
      </div>
    );
  };

  return (
    <div className="techstack-page" style={{ padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>TechStack</h2>

      <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={startScan} disabled={scanning}>{scanning ? "Scansione in corso..." : "Avvia scansione"}</button>
        <div style={{ color: "#666", fontSize: 13 }}>
          {loading ? "Caricamento…" : `Fonte: ${source ?? "unknown"}`}
        </div>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 8 }}>{error}</div>}

      {loading ? (
        <div>Caricamento risultati precedenti…</div>
      ) : (
        <>
          {renderSummary()}
        </>
      )}
    </div>
  );
}

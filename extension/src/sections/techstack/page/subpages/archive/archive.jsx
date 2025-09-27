// src/sections/techstack/page/subpages/archive/archive.jsx
import "./archive.css";
import techStackReactController from "../../../techstackController";
import browser from "webextension-polyfill";
import { useEffect, useState, useCallback } from "react";

/* ---------- Helpers UI ---------- */
function Accordion({ title, children, defaultOpen = false }) {
  return (
    <details className="acc" open={defaultOpen}>
      <summary className="acc-summary">{title}</summary>
      <div className="acc-panel">{children}</div>
    </details>
  );
}
function SectionGrid({ children }) { return <div className="grid">{children}</div>; }
function KeyVal({ k, v }) { return (<div className="kv"><div className="kv-k">{k}</div><div className="kv-v">{v}</div></div>); }
function Pill({ children }) { return <span className="pill">{children}</span>; }
function MonoBlock({ text }) { return (<pre className="mono">{text}</pre>); }
function EmptyNote({ text = "Nessun dato disponibile." }) { return <div className="empty-note">{text}</div>; }
function SimpleTable({ cols = [], rows = [] }) {
  if (!rows?.length) return <EmptyNote />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => (<td key={c}>{r[c] ?? "—"}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Utils ---------- */
function normalizeSnapshot(snap) {
  if (!snap) return null;
  // Cases:
  // - { meta, results } -> return as-is
  // - saved in local as { meta, results } inside results property: handled
  if (snap.meta && snap.results) return snap;
  if (snap.results && snap.results.meta && snap.results.results) {
    return { meta: snap.results.meta, results: snap.results.results };
  }
  if (snap.results) return { meta: snap.meta || {}, results: snap.results };
  // If receives raw results object (technologies, waf, ...), wrap it
  if (snap.technologies || snap.waf || snap.storage || snap.cookies || snap.raw) {
    return { meta: snap.meta || null, results: snap };
  }
  return null;
}

function MetaGrid({ meta }) {
  if (!meta) return null;
  return (
    <SectionGrid>
      <KeyVal k="URL" v={meta.url || "—"} />
      <KeyVal k="Timestamp" v={meta.timestamp ? new Date(meta.timestamp).toLocaleString() : "—"} />
      <KeyVal k="Tab ID" v={meta.tabId != null ? String(meta.tabId) : "—"} />
    </SectionGrid>
  );
}

function StatPills({ results }) {
  if (!results) return null;
  const pills = [
    `Technologies ${Array.isArray(results?.technologies) ? results.technologies.length : 0}`,
    `WAF ${Array.isArray(results?.waf) ? results.waf.length : 0}`,
    `SecureHeaders ${Array.isArray(results?.secureHeaders) ? results.secureHeaders.length : 0}`,
    `Cookies ${Array.isArray(results?.cookies) ? results.cookies.length : 0}`,
    `LocalStorage ${Array.isArray(results?.storage?.localStorage) ? results.storage.localStorage.length : 0}`,
    `SessionStorage ${Array.isArray(results?.storage?.sessionStorage) ? results.storage.sessionStorage.length : 0}`
  ];
  return <div className="pill-row">{pills.map((p, i) => <Pill key={i}>{p}</Pill>)}</div>;
}

function ResultPreview({ snapshot }) {
  if (!snapshot) return <EmptyNote />;
  const { meta, results } = snapshot;
  if (!results) return <EmptyNote />;

  const techPreview = (results?.technologies || []).slice(0, 30).map(t => `${t.name}${t.version ? ` (${t.version})` : ""}`);
  const headPreview = (results?.raw?.resolved || []).slice(0, 10).map((r, i) => ({ idx: i + 1, name: r.name || "—" }));

  return (
    <>
      <MetaGrid meta={meta} />
      <StatPills results={results} />

      {techPreview.length > 0 && (
        <>
          <h4>Technologies (preview)</h4>
          <ul>
            {techPreview.map((t, i) => <li key={i}><code>{t}</code></li>)}
          </ul>
        </>
      )}

      {Array.isArray(results?.secureHeaders) && results.secureHeaders.length > 0 && (
        <>
          <h4>Secure Headers (preview)</h4>
          {results.secureHeaders.map((f, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 6, border: "1px dashed #ddd", borderRadius: 4 }}>
              <div style={{ fontWeight: 700 }}>{f.header}</div>
              <div style={{ marginTop: 4 }}>{f.description}</div>
            </div>
          ))}
        </>
      )}

      {Array.isArray(results?.cookies) && results.cookies.length > 0 && (
        <>
          <h4>Cookies (preview)</h4>
          <SimpleTable
            cols={["domain", "name", "value", "httpOnly"]}
            rows={results.cookies.map(c => ({ domain: c.domain, name: c.name, value: String(c.value).slice(0, 160), httpOnly: c.httpOnly ? "yes" : "no" }))}
          />
        </>
      )}

      <h4>Storage (local/session preview)</h4>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <strong>LocalStorage</strong>
          <div style={{ maxHeight: 160, overflow: "auto", padding: 6, border: "1px solid #eee", marginTop: 6 }}>
            {Array.isArray(results?.storage?.localStorage) && results.storage.localStorage.length ? (
              <ul style={{ fontFamily: "monospace", fontSize: 13 }}>
                {results.storage.localStorage.map((it, idx) => <li key={idx}><code>{String(it).slice(0, 400)}</code></li>)}
              </ul>
            ) : <div style={{ color: "#666" }}>vuoto</div>}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <strong>SessionStorage</strong>
          <div style={{ maxHeight: 160, overflow: "auto", padding: 6, border: "1px solid #eee", marginTop: 6 }}>
            {Array.isArray(results?.storage?.sessionStorage) && results.storage.sessionStorage.length ? (
              <ul style={{ fontFamily: "monospace", fontSize: 13 }}>
                {results.storage.sessionStorage.map((it, idx) => <li key={idx}><code>{String(it).slice(0, 400)}</code></li>)}
              </ul>
            ) : <div style={{ color: "#666" }}>vuoto</div>}
          </div>
        </div>
      </div>

      <h4>Raw resolved (preview)</h4>
      <div style={{ maxHeight: 200, overflow: "auto", padding: 8, border: "1px solid #eee", background: "#fff" }}>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(results.raw?.resolved || headPreview, null, 2)}</pre>
      </div>

      <h4>JSON completo</h4>
      <MonoBlock text={JSON.stringify({ meta, results }, null, 2)} />
    </>
  );
}

/* ---------- Component ---------- */
function ArchiveTechStack() {
  const [loading, setLoading] = useState(true);
  const [currentTabSnap, setCurrentTabSnap] = useState(null);
  const [otherTabsSnaps, setOtherTabsSnaps] = useState([]);
  const [sessionSnap, setSessionSnap] = useState(null);
  const [localSnaps, setLocalSnaps] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // tab attiva
      const tid = await techStackReactController.getCurrentTabId();

      // mappa risultati per-tab salvata in sessione (techstack_lastByTab)
      let byTab = {};
      try {
        const obj = await browser.storage.session.get("techstack_lastByTab");
        byTab = obj?.techstack_lastByTab ?? {};
      } catch (e) {
        byTab = {};
      }

      // elenco tab attualmente APERTE (tutte le finestre)
      const openTabs = await browser.tabs.query({});
      const openIds = new Set(openTabs.map(t => t?.id).filter(id => id != null));

      // tab corrente (se presente nella mappa e ancora aperta)
      const cur = (tid != null && openIds.has(tid) && byTab?.[tid]) ? normalizeSnapshot(byTab[tid]) : null;
      setCurrentTabSnap(cur);

      // altri tab: SOLO quelli ancora aperti, escluso il tab corrente
      const others = Object.entries(byTab || {})
        .map(([k, v]) => [Number(k), v])
        .filter(([id]) => openIds.has(id) && String(id) !== String(tid))
        .map(([, v]) => normalizeSnapshot(v))
        .filter(Boolean)
        .sort((a, b) => (b?.meta?.timestamp || 0) - (a?.meta?.timestamp || 0));
      setOtherTabsSnaps(others);

      // sessione globale
      const sess = await techStackReactController.getSessionLastResult();
      setSessionSnap(normalizeSnapshot(sess));

      // archivio persistente (local)
      const locals = await techStackReactController.getLocalResults();
      const normalizedLocals = (Array.isArray(locals) ? locals : [])
        .map(s => {
          // local entries are expected like { key, results: { meta, results } }
          const norm = normalizeSnapshot(s.results || s);
          const ts = norm?.meta?.timestamp ?? (Number(String(s.key || "").replace("techstackResults_", "")) || 0);
          return { key: s.key, ts, snap: norm };
        })
        .filter(x => x.snap) // drop invalid
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setLocalSnaps(normalizedLocals);
    } catch (e) {
      console.error("[TechStack Archive] load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const off = techStackReactController.onMessage({
      onScanComplete: () => load(),
      onScanError: () => {}
    });
    return () => off();
  }, [load]);

  return (
    <div>
      <div className="archive-header" style={{ marginTop: 4 }}>
        <h2>TechStack — Archive</h2>
        <button className="archive-refresh" onClick={load} disabled={loading}>
          {loading ? "Aggiorno…" : "Aggiorna"}
        </button>
      </div>

      <Accordion title="Tab corrente" defaultOpen>
        {currentTabSnap ? <ResultPreview snapshot={currentTabSnap} /> : <EmptyNote text="Nessuna scansione per il tab corrente." />}
      </Accordion>

      <Accordion title={`Altri tab (${otherTabsSnaps.length})`}>
        {otherTabsSnaps.length
          ? otherTabsSnaps.map((s, i) => (
              <Accordion key={i} title={`${s?.meta?.tabId != null ? `Tab ${s.meta.tabId} — ` : ""}${s?.meta?.url || "—"}`}>
                <ResultPreview snapshot={s} />
              </Accordion>
            ))
          : <EmptyNote text="Nessuna scansione su altri tab attivi." />}
      </Accordion>

      <Accordion title="Sessione">
        {sessionSnap ? <ResultPreview snapshot={sessionSnap} /> : <EmptyNote text="Nessuna scansione di sessione disponibile." />}
      </Accordion>

      <Accordion title={`Local archive (${localSnaps.length})`}>
        {localSnaps.length
          ? localSnaps.map((s, i) => (
              <Accordion key={s.key || i} title={`${new Date(s.ts || Date.now()).toLocaleString()} — ${s.snap?.meta?.url || s.key || "—"}`}>
                <ResultPreview snapshot={s.snap} />
              </Accordion>
            ))
          : <EmptyNote text="Nessuna scansione salvata in memoria persistente." />}
      </Accordion>
    </div>
  );
}

export default ArchiveTechStack;

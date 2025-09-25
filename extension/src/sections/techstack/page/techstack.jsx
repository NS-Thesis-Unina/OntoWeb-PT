import { useEffect, useState } from "react";
import techStackReactController from "../techstackController";
import browser from "webextension-polyfill";

function TechStack() {
  const [stackData, setStackData] = useState(null);
  const [error, setError] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);

  useEffect(() => {
    const off = techStackReactController.onMessage({
      onScanComplete: (data) => {
        setError("");
        setStackData(data);
        setReloadRequired(false);
      },
      onScanError: (msg) => {
        setError(msg || "Errore sconosciuto");
        setStackData({});
      },
      onReloadRequired: () => {
        setReloadRequired(true);
      },
    });

    return () => off(); 
  }, []);

  const renderList = (items, extra = false) =>
    items?.length ? (
      <ul>
        {items.map((t, i) => (
          <li key={i}>
            {t.name}
            {t.version ? ` — v${t.version}` : ""}
            {t.domain ? ` (${t.domain})` : ""}
            {extra && t.description ? ` — ${t.description}` : ""}
          </li>
        ))}
      </ul>
    ) : (
      <p>Nessun dato rilevato.</p>
    );

  return (
    <div style={{ padding: "10px" }}>
      <h1>TechStack</h1>
      <button onClick={async () => {
        try {
          const tabId = await techStackReactController.getCurrentTabId();
          if (!tabId) throw new Error("Nessun tab attivo trovato.");
          techStackReactController.sendStartOneTimeStackScan(tabId);
        } catch (e) {
          setError(e.message || "Errore nell’avvio della scansione.");
        }
      }}>
        Avvia scansione
      </button>

      {reloadRequired && (
        <div style={{ margin: "10px 0", color: "darkorange" }}>
          ⚠️ Per completare la rilevazione, ricarica la pagina e rilancia la
          scansione.{" "}
          <button onClick={() => browser.tabs.reload()}>
            Ricarica pagina
          </button>
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {stackData && !reloadRequired && (
        <>
          <h3>Tecnologie</h3>
          {renderList(stackData.technologies)}

          <h3>WAF / CDN</h3>
          {renderList(stackData.waf)}

          <h3>OWASP Secure Headers</h3>
          {renderList(stackData.secureHeaders, true)}

          <h3>Cookies</h3>
          {stackData.cookies?.length ? (
            <ul>
              {stackData.cookies.map((c, i) => (
                <li key={i}>
                  <b>{c.name}</b>={c.value} {c.httpOnly ? "(HttpOnly)" : ""} [
                  {c.domain}]
                </li>
              ))}
            </ul>
          ) : (
            <p>Nessun cookie trovato.</p>
          )}

          <h3>LocalStorage</h3>
          {stackData.storage?.localStorage?.length ? (
            <ul>
              {stackData.storage.localStorage.map((item, i) => (
                <li key={i}>
                  {item.key} = {item.value}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nessun valore trovato.</p>
          )}

          <h3>SessionStorage</h3>
          {stackData.storage?.sessionStorage?.length ? (
            <ul>
              {stackData.storage.sessionStorage.map((item, i) => (
                <li key={i}>
                  {item.key} = {item.value}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nessun valore trovato.</p>
          )}
        </>
      )}
    </div>
  );
}

export default TechStack;

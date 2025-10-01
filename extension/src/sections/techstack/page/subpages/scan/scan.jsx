import { Alert, Backdrop, Button, CircularProgress, Divider, Grid, Grow, LinearProgress, Paper, Typography, Zoom } from "@mui/material";
import "./scan.css";
import Collapsible from "../../../../../components/collapsible/collapsible";
import techStackReactController from "../../../techstackController";
import { useCallback, useEffect, useState } from "react";
import { formatWhen, getDomainAccurate } from "../../../../../libs/formatting";
import CollapsibleList from "../../../../../components/collapsible/collapsibleList/collapsibleList";
import CollapsibleSecureHeaders from "../../../components/collapsibleSecureHeaders/collapsibleSecureHeaders";
import CollapsibleDataGrid from "../../../../../components/collapsible/collapsibleDataGrid/collapsibleDataGrid";
import { Inspector, chromeLight, chromeDark } from 'react-inspector';
import { useThemeMode } from "../../../../../theme/themeModeProvider";
import ScanResults from "../components/scanResults/scanResults";

function ScanTechStack(){

  const [loading, setLoading] = useState(true);
  const [loadSource, setLoadSource] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const tabId = await techStackReactController.getCurrentTabId();
        const res = await techStackReactController.loadLastAvailable(tabId);
        if (!mounted) return;
        if(res.data !== null){
          const domain = getDomainAccurate(res.data.meta.url);
          const date = formatWhen(res.data.meta.timestamp);
          res.data = {...res.data, meta: {...res.data.meta, domain, date}};
          setLoadSource(res.source);
          setResults(res.data);
        }
      } catch (e) {
        setError("Errore nel caricamento dei risultati precedenti.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const off = techStackReactController.onMessage({
      onScanComplete: (p) => {
        const domain = getDomainAccurate(p.meta.url);
        const date = formatWhen(p.meta.timestamp);
        p = {...p, meta: {...p.meta, domain, date}};
        setLoadSource("scan");
        setResults(p);
        setScanning(false);
      },
      onScanError: (msg) => {
        setError(msg || "Errore nella scansione TechStack.");
        setScanning(false);
      }
    });

    return () => {
      mounted = false;
      off();
    };
  }, []);

  const startScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    const tabId = await techStackReactController.getCurrentTabId();
    techStackReactController.sendStartOneTimeStackScan(tabId);
  }, []);

  if(loading){
    return(
      <div className="scanteckstack-div">
        <Backdrop open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>
    )
  }

  return(
    <div className="scanteckstack-div">
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>Technology Stack</strong> identifica e sintetizza le tecnologie e i servizi usati da 
            una pagina web, aggregando evidenze provenienti da header, script, cookie, storage e 
            analisi statiche. Serve da punto di partenza per la ricognizione tecnica: fornisce 
            sia un riepilogo rapido (che cosa c’è) sia i dettagli utili per approfondire controlli mirati 
            e preparare report.
          </Typography>
        </Zoom>
      </Paper>
      <Collapsible defaultOpen={false} title="Info Output">
        <ul style={{paddingInlineStart: "20px"}}>
          <li><strong>Technologies</strong>: elenco sintetico delle librerie, framework e servizi rilevati (nome e versione quando disponibili).</li>
          <li><strong>SecureHeaders</strong>: risultati dei controlli sugli header di sicurezza (es. HSTS, CSP, X-Content-Type-Options) con indicazione delle mancanze o anomalie.</li>
          <li><strong>WAF</strong>: identificazione di Web Application Firewall, CDN o proxy edge presenti (es. Cloudflare, AWS CloudFront, FortiWeb).</li>
          <li><strong>Cookies</strong>: lista dei cookie rilevati (dominio, nome, flag httpOnly) con anteprima dei valori utili per l’analisi della sessione/SSO.</li>
          <li><strong>Storage</strong>: dump di localStorage e sessionStorage (chiavi/valori) per individuare dati esposti a JavaScript come token o configurazioni client-side.</li>
          <li><strong>Raw</strong>: output grezzo/di dettaglio (es. Wappalyzer resolved) contenente metadati, categorie, confidence e informazioni utili per approfondimenti.</li>
        </ul>
      </Collapsible>
      {error && (
        <Grow in={error}>
          <Alert className="alert" variant="filled" severity="error">
            {error}
          </Alert>
        </Grow>
      )}
      <Button onClick={startScan} className="scanButton" variant="contained" size="large" loading={scanning} loadingIndicator="Scansione in corso..." >
        {!results ? "Avvia Scansione":"Nuova scansione"}
      </Button>
      {results && (
        <ScanResults results={results} loadSource={loadSource} />
      )}
    </div>
  )
}

export default ScanTechStack;
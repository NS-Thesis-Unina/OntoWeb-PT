import { useEffect, useState } from "react";
import { Paper, Typography, CircularProgress, Button, Chip } from "@mui/material";
import "./openapi.css";

export default function OpenAPI() {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function loadLocalSchema() {
      try {
        // IMPORT DINAMICO DEL JSON LOCALE
        const json = await import("./openapi.json");
        setSchema(json.default || json);
      } catch (err) {
        console.error("Errore caricando la OpenAPI:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLocalSchema();
  }, []);

  if (loading) {
    return (
      <div className="openapi-loading">
        <CircularProgress />
      </div>
    );
  }

  if (!schema) {
    return <Typography>Impossibile caricare il file OpenAPI.</Typography>;
  }

  const endpoints = Object.entries(schema.paths);

  return (
    <div className="openapi-container">

      {/* INTRO */}
      <Paper className="intro">
        <Typography variant="h5" fontWeight={700}>OpenAPI Explorer</Typography>
        <Typography variant="body1">
          Questa pagina mostra tutti gli endpoint REST del backend OntoWeb-PT.
          Lo schema è caricato localmente da un file <strong>openapi.json</strong>.
        </Typography>
      </Paper>

      {/* LISTA ENDPOINT */}
      <div className="endpoints-list">
        {endpoints.map(([path, methods]) =>
          Object.entries(methods).map(([method, info]) => (
            <Paper
              key={path + method}
              className="endpoint-card"
              onClick={() => setSelected({ path, method, info })}
            >
              <Chip label={method.toUpperCase()} color={method === "get" ? "primary" : "secondary"} />
              <Typography variant="h6">{path}</Typography>
              <Typography variant="body2" className="summary">
                {info.summary || ""}
              </Typography>
            </Paper>
          ))
        )}
      </div>

      {/* DETTAGLI ENDPOINT */}
      {selected && (
        <Paper className="endpoint-details">
          <Typography variant="h6">
            {selected.method.toUpperCase()} — {selected.path}
          </Typography>

          <Typography variant="body1" style={{ marginTop: 10 }}>
            {selected.info.description || "No description available."}
          </Typography>

          {/* Request Body */}
          {selected.info.requestBody && (
            <>
              <Typography variant="h6" style={{ marginTop: 15 }}>Request Body</Typography>
              <pre className="json-box">
                {JSON.stringify(selected.info.requestBody, null, 2)}
              </pre>
            </>
          )}

          {/* Responses */}
          <Typography variant="h6" style={{ marginTop: 15 }}>Responses</Typography>
          <pre className="json-box">
            {JSON.stringify(selected.info.responses, null, 2)}
          </pre>

          <Button variant="contained" color="primary" style={{ marginTop: 20 }}>
            Esegui richiesta
          </Button>
        </Paper>
      )}

    </div>
  );
}

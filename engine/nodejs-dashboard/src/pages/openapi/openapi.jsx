import { useEffect, useState } from "react";
import OpenAPIGroup from "./components/openApiGroup/openApiGroup";
import { CircularProgress, Box, Typography, Zoom, Paper } from "@mui/material";
import "./openApi.css";

const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "options", "head"];

function mergeParameters(pathParams = [], opParams = []) {
  const map = new Map();

  [...pathParams, ...opParams].forEach((p) => {
    if (!p || !p.name) return;
    const key = `${p.in || "other"}:${p.name}`;
    map.set(key, p);
  });

  return Array.from(map.values());
}

export default function OpenAPIExplorer() {
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    import("./openapi.json").then((mod) => {
      setSchema(mod.default || mod);
    });
  }, []);

  if (!schema) {
    return (
      <Box sx={{ textAlign: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  const groups = {};

  Object.entries(schema.paths || {}).forEach(([path, pathItem]) => {
    const pathLevelParams = pathItem.parameters || [];

    Object.entries(pathItem || {}).forEach(([method, info]) => {
      const m = method.toLowerCase();
      if (!HTTP_METHODS.includes(m)) return; // salta `parameters` & co.

      const tag = info.tags?.[0] || "General";
      if (!groups[tag]) groups[tag] = [];

      const opParams = info.parameters || [];
      const parameters = mergeParameters(pathLevelParams, opParams);

      groups[tag].push({
        method: m,
        path,
        summary: info.summary,
        description: info.description,
        requestBody: info.requestBody,
        responses: info.responses,
        parameters,
      });
    });
  });

  return (
    <div className="openapi-div">
      <Typography className="title">API Explorer</Typography>

      <Zoom in={true}>
        <Paper className="description">
          Explore the OntoWeb backend APIs for ingesting and analyzing HTTP traffic, 
          extracting requests from PCAP captures, running static and tech-stack analysis, 
          querying the knowledge graph via SPARQL, and inspecting detected findings. 
          Expand an endpoint to view its parameters, request body, and detailed response schema.
        </Paper>
      </Zoom>

      {Object.entries(groups).map(([tag, endpoints]) => (
        <OpenAPIGroup key={tag} tag={tag} endpoints={endpoints} schema={schema} />
      ))}
    </div>
  );
}

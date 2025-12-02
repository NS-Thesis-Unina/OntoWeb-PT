import { useEffect, useState } from "react";
import OpenAPIGroup from "./components/openApiGroup";
import { CircularProgress, Box, Typography, Zoom, Paper } from "@mui/material";
import "./openapi.css";

export default function OpenAPIExplorer() {
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    import("./openapi.json").then(mod => {
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

  Object.entries(schema.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, info]) => {
      const tag = info.tags?.[0] || "General";

      if (!groups[tag]) groups[tag] = [];

      groups[tag].push({
        method,
        path,
        summary: info.summary,
        description: info.description,
        requestBody: info.requestBody,
        responses: info.responses,
      });
    });
  });

  return (
    <div className="openapi-div">
      <Typography className="title">OntoWeb API Explorer</Typography>

      <Zoom in={true}>
        <Paper className="description">
          This section displays the APIs of our nodejs backend.
        </Paper>
      </Zoom>

      {Object.entries(groups).map(([tag, endpoints]) => (
        <OpenAPIGroup key={tag} tag={tag} endpoints={endpoints} />
      ))}
    </div>
  );
}

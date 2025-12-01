import { useEffect, useState } from "react";
import OpenAPIGroup from "./components/openApiGroup";
import { CircularProgress, Box, Typography } from "@mui/material";

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
    <Box sx={{ maxWidth: 900, margin: "0 auto", mt: 4 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 3 }}>
        OntoWeb API Explorer
      </Typography>

      {Object.entries(groups).map(([tag, endpoints]) => (
        <OpenAPIGroup key={tag} tag={tag} endpoints={endpoints} />
      ))}
    </Box>
  );
}

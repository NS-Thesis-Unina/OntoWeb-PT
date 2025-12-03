import './openApi.css';
import { useEffect, useState } from 'react';
import OpenAPIGroup from './components/openApiGroup/openApiGroup';
import { CircularProgress, Box, Typography, Zoom, Paper } from '@mui/material';

/** Supported HTTP methods to extract from each path item. */
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

/**
 * Merge path-level and operation-level parameters, favoring operation params.
 *
 * @param {Array<Object>} pathParams - Parameters declared at the path item level.
 * @param {Array<Object>} opParams   - Parameters declared at the operation level.
 * @returns {Array<Object>}           - De-duplicated parameter list.
 */
function mergeParameters(pathParams = [], opParams = []) {
  const map = new Map();

  [...pathParams, ...opParams].forEach((p) => {
    if (!p || !p.name) return;
    const key = `${p.in || 'other'}:${p.name}`;
    map.set(key, p);
  });

  return Array.from(map.values());
}

/**
 * Page: API Explorer
 *
 * Architectural Role:
 * - Client-side OpenAPI (Swagger) explorer for the backend APIs.
 * - Dynamically loads the OpenAPI schema and renders endpoints grouped by tag.
 *
 * Responsibilities:
 * - Import the local OpenAPI document (JSON) at runtime.
 * - Normalize and group endpoints by the first tag (fallback: "General").
 * - Merge path-level and operation-level parameters with operation precedence.
 * - Delegate endpoint rendering to <OpenAPIGroup />.
 *
 * UX Notes:
 * - Shows a centered spinner until the schema is loaded.
 * - Provides an introductory description with a subtle <Zoom> animation.
 *
 * Implementation Details:
 * - `HTTP_METHODS` limits processing to valid HTTP verbs, skipping non-op keys like `parameters`.
 * - `mergeParameters()` de-duplicates parameters using a composite key `${in}:${name}`.
 * - The component is stateless after schema load; groups are recomputed on each render.
 *   Consider memoizing (e.g., useMemo) if the schema is large and updates frequently.
 */
export default function OpenAPIExplorer() {
  const [schema, setSchema] = useState(null);

  // Lazy-load the OpenAPI document (bundled JSON asset).
  useEffect(() => {
    import('./openapi.json').then((mod) => {
      setSchema(mod.default || mod);
    });
  }, []);

  // Initial loading state: centered spinner.
  if (!schema) {
    return (
      <div className="openApi-loading-div">
        <CircularProgress />
      </div>
    );
  }

  // Build endpoint groups keyed by tag.
  const groups = {};

  Object.entries(schema.paths || {}).forEach(([path, pathItem]) => {
    const pathLevelParams = pathItem.parameters || [];

    Object.entries(pathItem || {}).forEach(([method, info]) => {
      const m = method.toLowerCase();
      if (!HTTP_METHODS.includes(m)) return; // skip non-operation keys

      const tag = info.tags?.[0] || 'General';
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

      {/* Introductory copy */}
      <Zoom in={true}>
        <Paper className="description">
          Explore the OntoWeb backend APIs for ingesting and analyzing HTTP traffic, extracting
          requests from PCAP captures, running static and tech-stack analysis, querying the
          knowledge graph via SPARQL, and inspecting detected findings. Expand an endpoint to view
          its parameters, request body, and detailed response schema.
        </Paper>
      </Zoom>

      {/* Grouped endpoints by tag */}
      {Object.entries(groups).map(([tag, endpoints]) => (
        <OpenAPIGroup key={tag} tag={tag} endpoints={endpoints} schema={schema} />
      ))}
    </div>
  );
}

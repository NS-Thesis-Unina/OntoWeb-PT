import './openApiGroup.css';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/** Map HTTP method → MUI Chip color for quick visual scanning. */
const METHOD_COLORS = {
  get: 'info',
  post: 'success',
  put: 'warning',
  delete: 'error',
  patch: 'primary',
  options: 'secondary',
  head: 'default',
};

/**
 * Resolve a local JSON Reference (e.g. "#/components/schemas/MyType")
 * against the root OpenAPI schema.
 *
 * @param {string} ref - Local $ref string starting with "#/".
 * @param {object} rootSchema - The full OpenAPI document (root).
 * @returns {any|null} The referenced node or null if not found/invalid.
 */
function resolveRef(ref, rootSchema) {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('#/')) return null;

  // Remove "#/" and traverse object path segments.
  const path = ref.slice(2).split('/');
  let current = rootSchema;

  for (const segment of path) {
    if (!current || typeof current !== 'object') return null;
    current = current[segment];
  }

  return current || null;
}

/**
 * Recursively dereference a schema node by resolving local $ref pointers.
 * - Merges local overrides with resolved target content.
 * - Detects simple $ref cycles using a Set of visited refs.
 * - Traverses common schema composition keywords (properties, items, allOf, anyOf, oneOf).
 *
 * @param {object} schemaNode - Schema or schema fragment to dereference.
 * @param {object} rootSchema - The full OpenAPI schema (used to resolve refs).
 * @param {Set<string>} [seen] - Internal set to break reference cycles.
 * @returns {object} A fully (best-effort) dereferenced schema node.
 */
function derefSchema(schemaNode, rootSchema, seen = new Set()) {
  if (!schemaNode || typeof schemaNode !== 'object') return schemaNode;

  // Handle direct $ref on the current node
  if (schemaNode.$ref) {
    const ref = schemaNode.$ref;
    if (seen.has(ref)) {
      // Stop if we detect a cycle; return the node as-is.
      return schemaNode;
    }

    const target = resolveRef(ref, rootSchema);
    if (!target) return schemaNode;

    const newSeen = new Set(seen);
    newSeen.add(ref);

    // Resolve the referenced target, then merge local overrides
    const resolvedTarget = derefSchema(target, rootSchema, newSeen);

    const { $ref, ...restLocal } = schemaNode;
    const merged = {
      ...resolvedTarget,
      ...restLocal,
    };

    // Re-run deref on the merged structure in case it adds new refs.
    return derefSchema(merged, rootSchema, newSeen);
  }

  // Clone before deep-walking children
  const result = { ...schemaNode };

  // Recurse into object properties
  if (result.properties && typeof result.properties === 'object') {
    const newProps = {};
    for (const [key, value] of Object.entries(result.properties)) {
      newProps[key] = derefSchema(value, rootSchema, seen);
    }
    result.properties = newProps;
  }

  // Recurse into arrays
  if (result.items) {
    result.items = derefSchema(result.items, rootSchema, seen);
  }

  // Recurse into composition keywords
  ['allOf', 'anyOf', 'oneOf'].forEach((kw) => {
    if (Array.isArray(result[kw])) {
      result[kw] = result[kw].map((s) => derefSchema(s, rootSchema, seen));
    }
  });

  return result;
}

/**
 * Pick and dereference the preferred request body schema for an endpoint.
 * Preference order: application/json → multipart/form-data → application/x-www-form-urlencoded.
 * Falls back to the first available content schema if none of the above exists.
 *
 * @param {object} ep - Endpoint object (from OpenAPI paths).
 * @param {object} rootSchema - Full OpenAPI document.
 * @returns {object|null} Dereferenced schema or null if not present.
 */
function getResolvedRequestSchema(ep, rootSchema) {
  const rb = ep.requestBody;
  if (!rb || !rb.content) return null;

  const preferredContentTypes = [
    'application/json',
    'multipart/form-data',
    'application/x-www-form-urlencoded',
  ];

  // Try preferred content types first
  for (const ct of preferredContentTypes) {
    const content = rb.content[ct];
    if (content && content.schema) {
      return derefSchema(content.schema, rootSchema);
    }
  }

  // Otherwise: pick the first content that exposes a schema
  const anyContent = Object.values(rb.content).find((c) => c && c.schema);
  if (anyContent) {
    return derefSchema(anyContent.schema, rootSchema);
  }

  return null;
}

/**
 * Collect and dereference JSON response schemas keyed by HTTP status.
 * Only "application/json" content is considered here.
 *
 * @param {object} ep - Endpoint object.
 * @param {object} rootSchema - Full OpenAPI document.
 * @returns {Record<string, {description?:string, schema?:object}>}
 */
function getResolvedResponses(ep, rootSchema) {
  const responses = ep.responses || {};
  const result = {};

  Object.entries(responses).forEach(([status, resp]) => {
    const base = { description: resp.description };

    const content = resp.content && resp.content['application/json'];
    const schemaNode = content && content.schema;

    if (schemaNode) {
      base.schema = derefSchema(schemaNode, rootSchema);
    }

    result[status] = base;
  });

  return result;
}

/**
 * Locate and dereference the parameter schema, from either:
 *   - param.schema
 *   - param.content["application/json"].schema
 *
 * @param {object} param
 * @param {object} rootSchema
 * @returns {object|null}
 */
function getParamSchema(param, rootSchema) {
  if (!param) return null;
  const schemaNode =
    param.schema ||
    (param.content &&
      param.content['application/json'] &&
      param.content['application/json'].schema);

  if (!schemaNode) return null;
  return derefSchema(schemaNode, rootSchema);
}

/**
 * Infer a human-friendly parameter type string from its (dereferenced) schema.
 * Examples: "string", "number", "array<string>", "enum", "object", "any".
 *
 * @param {object} param
 * @param {object} rootSchema
 * @returns {string}
 */
function getParamType(param, rootSchema) {
  const schema = getParamSchema(param, rootSchema);
  if (!schema) return 'any';

  if (schema.type === 'array' && schema.items) {
    const inner = schema.items.type || 'any';
    return `array<${inner}>`;
  }

  if (schema.type) return schema.type;
  if (schema.enum) return 'enum';
  return 'object';
}

/**
 * Group parameters by their `in` location (query, path, header, cookie).
 *
 * @param {Array} parameters
 * @returns {Record<string, Array>}
 */
function groupParameters(parameters = []) {
  const groups = {};
  parameters.forEach((p) => {
    const loc = p.in || 'other';
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(p);
  });
  return groups;
}

/**
 * Convert an OpenAPI `in` location to a user-facing label.
 *
 * @param {string} loc
 * @returns {string}
 */
function prettyLocation(loc) {
  switch (loc) {
    case 'query':
      return 'Query parameters (filters)';
    case 'path':
      return 'Path parameters';
    case 'header':
      return 'Header parameters';
    case 'cookie':
      return 'Cookie parameters';
    default:
      return 'Other parameters';
  }
}

/**
 * Component: OpenAPIGroup
 *
 * Purpose:
 *   Render a collapsible, readable list of OpenAPI endpoints grouped by tag.
 *   Each endpoint is shown inside an MUI Accordion and includes:
 *     - Method + path + short summary in the header.
 *     - Full description, parameters (grouped by location), request body schema,
 *       and responses schema in the details.
 *
 * Key responsibilities:
 *   - Dereference $ref pointers inside schemas (local refs only, "#/...").
 *   - Prefer common content types for request body (JSON, multipart, urlencoded).
 *   - Present parameters grouped by location (query, path, header, cookie).
 *   - Render response schemas (JSON only) per HTTP status code.
 *
 * Notes:
 *   - This component assumes `endpoints` have already been collected by tag,
 *     and that each endpoint object looks like:
 *       { method, path, summary, description, requestBody, responses, parameters }
 *   - Output is read-only and meant for exploration/documentation purposes.
 *
 * @param {object} props
 * @param {string} props.tag            Group label (OpenAPI tag).
 * @param {Array}  props.endpoints      List of endpoints for this tag.
 * @param {object} props.schema         Root OpenAPI document (for $ref resolution).
 */
export default function OpenAPIGroup({ tag, endpoints, schema }) {
  return (
    <Box className="openapi-group-root">
      {/* Group heading (OpenAPI tag) */}
      <Typography variant="h5" className="openapi-group-title">
        {tag}
      </Typography>

      {endpoints.map((ep, i) => {
        // Precompute dereferenced artifacts used in the details panel
        const resolvedRequestSchema = getResolvedRequestSchema(ep, schema);
        const resolvedResponses = getResolvedResponses(ep, schema);
        const groupedParams = groupParameters(ep.parameters);

        return (
          <Accordion key={i} className="openapi-group-accordion">
            {/* Accordion header: method chip + path + short summary */}
            <AccordionSummary expandIcon={<ExpandMoreIcon />} className="openapi-group-summary">
              <Chip
                label={ep.method.toUpperCase()}
                color={METHOD_COLORS[ep.method] || 'default'}
                className="openapi-group-method-chip"
              />

              <Typography className="openapi-group-path">{ep.path}</Typography>

              <Typography
                color="text.secondary"
                className="openapi-group-summary-text"
                sx={{ ml: 1 }}
              >
                {ep.summary}
              </Typography>
            </AccordionSummary>

            {/* Accordion body: description, parameters, request/response schemas */}
            <AccordionDetails className="openapi-group-details">
              {/* Description */}
              <Typography variant="subtitle1" className="openapi-group-section-title">
                Description
              </Typography>
              <Typography variant="body2" className="openapi-group-description-text">
                {ep.description || 'No description'}
              </Typography>

              {/* Parameters (grouped by location) */}
              {ep.parameters && ep.parameters.length > 0 && (
                <>
                  <Typography variant="subtitle1" className="openapi-group-section-title">
                    Parameters
                  </Typography>

                  {Object.entries(groupedParams).map(([loc, params]) => (
                    <Box key={loc} sx={{ mt: 1 }}>
                      <Typography variant="subtitle2">{prettyLocation(loc)}</Typography>
                      <Box component="ul" sx={{ pl: 3, mt: 0.5, mb: 0 }}>
                        {params.map((p) => (
                          <li key={`${loc}:${p.name}`}>
                            <Typography variant="body2">
                              <strong>{p.name}</strong>
                              {p.required ? ' (required)' : ' (optional)'} –{' '}
                              {getParamType(p, schema)}
                              {p.description ? ` – ${p.description}` : ''}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </>
              )}

              {/* Request body schema (preferred content-type if available) */}
              {resolvedRequestSchema && (
                <>
                  <Typography variant="subtitle1" className="openapi-group-section-title">
                    Request Body
                  </Typography>
                  <pre className="openapi-group-code-block">
                    {JSON.stringify(resolvedRequestSchema, null, 2)}
                  </pre>
                </>
              )}

              {/* Responses (JSON schemas per status code) */}
              <Typography
                variant="subtitle1"
                className="openapi-group-section-title openapi-group-responses-title"
              >
                Responses Body
              </Typography>
              <pre className="openapi-group-code-block">
                {JSON.stringify(resolvedResponses, null, 2)}
              </pre>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

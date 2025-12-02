import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Typography,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import "./openApiGroup.css";

const METHOD_COLORS = {
  get: "info",
  post: "success",
  put: "warning",
  delete: "error",
  patch: "primary",
  options: "secondary",
  head: "default",
};

function resolveRef(ref, rootSchema) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("#/")) return null;

  const path = ref.slice(2).split("/"); // rimuove "#/"
  let current = rootSchema;

  for (const segment of path) {
    if (!current || typeof current !== "object") return null;
    current = current[segment];
  }

  return current || null;
}

function derefSchema(schemaNode, rootSchema, seen = new Set()) {
  if (!schemaNode || typeof schemaNode !== "object") return schemaNode;

  if (schemaNode.$ref) {
    const ref = schemaNode.$ref;
    if (seen.has(ref)) {
      return schemaNode;
    }

    const target = resolveRef(ref, rootSchema);
    if (!target) return schemaNode;

    const newSeen = new Set(seen);
    newSeen.add(ref);

    const resolvedTarget = derefSchema(target, rootSchema, newSeen);

    const { $ref, ...restLocal } = schemaNode;
    const merged = {
      ...resolvedTarget,
      ...restLocal,
    };

    return derefSchema(merged, rootSchema, newSeen);
  }

  const result = { ...schemaNode };

  if (result.properties && typeof result.properties === "object") {
    const newProps = {};
    for (const [key, value] of Object.entries(result.properties)) {
      newProps[key] = derefSchema(value, rootSchema, seen);
    }
    result.properties = newProps;
  }

  if (result.items) {
    result.items = derefSchema(result.items, rootSchema, seen);
  }

  ["allOf", "anyOf", "oneOf"].forEach((kw) => {
    if (Array.isArray(result[kw])) {
      result[kw] = result[kw].map((s) => derefSchema(s, rootSchema, seen));
    }
  });

  return result;
}

function getResolvedRequestSchema(ep, rootSchema) {
  const rb = ep.requestBody;
  if (!rb || !rb.content) return null;

  const preferredContentTypes = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
  ];

  for (const ct of preferredContentTypes) {
    const content = rb.content[ct];
    if (content && content.schema) {
      return derefSchema(content.schema, rootSchema);
    }
  }

  const anyContent = Object.values(rb.content).find(
    (c) => c && c.schema
  );
  if (anyContent) {
    return derefSchema(anyContent.schema, rootSchema);
  }

  return null;
}

function getResolvedResponses(ep, rootSchema) {
  const responses = ep.responses || {};
  const result = {};

  Object.entries(responses).forEach(([status, resp]) => {
    const base = {
      description: resp.description,
    };

    const content = resp.content && resp.content["application/json"];
    const schemaNode = content && content.schema;

    if (schemaNode) {
      base.schema = derefSchema(schemaNode, rootSchema);
    }

    result[status] = base;
  });

  return result;
}

function getParamSchema(param, rootSchema) {
  if (!param) return null;
  const schemaNode =
    param.schema ||
    (param.content && param.content["application/json"] && param.content["application/json"].schema);

  if (!schemaNode) return null;
  return derefSchema(schemaNode, rootSchema);
}

function getParamType(param, rootSchema) {
  const schema = getParamSchema(param, rootSchema);
  if (!schema) return "any";

  if (schema.type === "array" && schema.items) {
    const inner = schema.items.type || "any";
    return `array<${inner}>`;
  }

  if (schema.type) return schema.type;
  if (schema.enum) return "enum";
  return "object";
}

function groupParameters(parameters = []) {
  const groups = {};
  parameters.forEach((p) => {
    const loc = p.in || "other";
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(p);
  });
  return groups;
}

function prettyLocation(loc) {
  switch (loc) {
    case "query":
      return "Query parameters (filters)";
    case "path":
      return "Path parameters";
    case "header":
      return "Header parameters";
    case "cookie":
      return "Cookie parameters";
    default:
      return "Other parameters";
  }
}

export default function OpenAPIGroup({ tag, endpoints, schema }) {
  return (
    <Box className="openapi-group-root">
      <Typography variant="h5" className="openapi-group-title">
        {tag}
      </Typography>

      {endpoints.map((ep, i) => {
        const resolvedRequestSchema = getResolvedRequestSchema(ep, schema);
        const resolvedResponses = getResolvedResponses(ep, schema);
        const groupedParams = groupParameters(ep.parameters);

        return (
          <Accordion key={i} className="openapi-group-accordion">
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              className="openapi-group-summary"
            >
              <Chip
                label={ep.method.toUpperCase()}
                color={METHOD_COLORS[ep.method] || "default"}
                className="openapi-group-method-chip"
              />

              <Typography className="openapi-group-path">
                {ep.path}
              </Typography>
              <Typography
                color="text.secondary"
                className="openapi-group-summary-text"
                sx={{ ml: 1 }}
              >
                {ep.summary}
              </Typography>
            </AccordionSummary>

            <AccordionDetails className="openapi-group-details">
              <Typography
                variant="subtitle1"
                className="openapi-group-section-title"
              >
                Description
              </Typography>
              <Typography
                variant="body2"
                className="openapi-group-description-text"
              >
                {ep.description || "No description"}
              </Typography>

              {ep.parameters && ep.parameters.length > 0 && (
                <>
                  <Typography
                    variant="subtitle1"
                    className="openapi-group-section-title"
                  >
                    Parameters
                  </Typography>

                  {Object.entries(groupedParams).map(([loc, params]) => (
                    <Box key={loc} sx={{ mt: 1 }}>
                      <Typography variant="subtitle2">
                        {prettyLocation(loc)}
                      </Typography>
                      <Box component="ul" sx={{ pl: 3, mt: 0.5, mb: 0 }}>
                        {params.map((p) => (
                          <li key={`${loc}:${p.name}`}>
                            <Typography variant="body2">
                              <strong>{p.name}</strong>
                              {p.required ? " (required)" : " (optional)"} –{" "}
                              {getParamType(p, schema)}
                              {p.description ? ` – ${p.description}` : ""}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </>
              )}

              {resolvedRequestSchema && (
                <>
                  <Typography
                    variant="subtitle1"
                    className="openapi-group-section-title"
                  >
                    Request Body
                  </Typography>
                  <pre className="openapi-group-code-block">
                    {JSON.stringify(resolvedRequestSchema, null, 2)}
                  </pre>
                </>
              )}

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

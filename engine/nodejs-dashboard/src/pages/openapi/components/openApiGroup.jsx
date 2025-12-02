import { Accordion, AccordionSummary, AccordionDetails, Chip, Typography, Box } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import "./openApiGroup.css";

const METHOD_COLORS = {
  get: "info",
  post: "success",
  put: "warning",
  delete: "error",
};

export default function OpenAPIGroup({ tag, endpoints }) {
  return (
    <Box className="openapi-group-root">
      <Typography variant="h5" className="openapi-group-title">
        {tag}
      </Typography>

      {endpoints.map((ep, i) => (
        <Accordion key={i} className="openapi-group-accordion">
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            className="openapi-group-summary"
          >
            <Chip
              label={ep.method.toUpperCase()}
              color={METHOD_COLORS[ep.method]}
              className="openapi-group-method-chip"
            />

            <Typography className="openapi-group-path">
              {ep.path}
            </Typography>
              -
            <Typography color="text.secondary" className="openapi-group-summary-text">
              {ep.summary}
            </Typography>
          </AccordionSummary>

          <AccordionDetails className="openapi-group-details">
            <Typography variant="subtitle1" className="openapi-group-section-title">
              Description
            </Typography>
            <Typography variant="body2" className="openapi-group-description-text">
              {ep.description || "No description"}
            </Typography>

            {ep.requestBody && (
              <>
                <Typography variant="subtitle1" className="openapi-group-section-title">
                  Request Body
                </Typography>
                <pre className="openapi-group-code-block">
                  {JSON.stringify(ep.requestBody, null, 2)}
                </pre>
              </>
            )}

            <Typography
              variant="subtitle1"
              className="openapi-group-section-title openapi-group-responses-title"
            >
              Responses
            </Typography>
            <pre className="openapi-group-code-block">
              {JSON.stringify(ep.responses, null, 2)}
            </pre>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

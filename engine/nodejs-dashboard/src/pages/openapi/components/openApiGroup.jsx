
import { Accordion, AccordionSummary, AccordionDetails, Chip, Typography, Box } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const METHOD_COLORS = {
  get: "info",
  post: "success",
  put: "warning",
  delete: "error",
};

export default function OpenAPIGroup({ tag, endpoints }) {
  return (
    <Box sx={{ marginBottom: 3 }}>
      <Typography variant="h5" fontWeight="bold">{tag}</Typography>

      {endpoints.map((ep, i) => (
        <Accordion key={i} sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Chip
              label={ep.method.toUpperCase()}
              color={METHOD_COLORS[ep.method]}
              sx={{ mr: 2, fontWeight: 700 }}
            />

            <Typography sx={{ mr: 2 }} fontWeight={600}>
              {ep.path}
            </Typography>

            <Typography color="text.secondary">
              {ep.summary}
            </Typography>
          </AccordionSummary>

          <AccordionDetails>
            <Typography variant="subtitle1" fontWeight="bold">Description</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {ep.description || "No description"}
            </Typography>

            {/* Request Body */}
            {ep.requestBody && (
              <>
                <Typography variant="subtitle1" fontWeight="bold">Request Body</Typography>
                 <pre style={{ background: "#2a2a2a", padding: 10, color: "#eee", borderRadius: 4 }}>
                  {JSON.stringify(ep.requestBody, null, 2)}
                </pre>
              </>
            )}

            {/* Responses */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>Responses</Typography>
            <pre style={{ background: "#2a2a2a", padding: 10, color: "#eee", borderRadius: 4 }}>
              {JSON.stringify(ep.responses, null, 2)}
            </pre>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

import { Accordion, AccordionSummary, AccordionDetails, Chip, Stack, Typography, Paper } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const METHOD_COLORS = {
  get: "info",
  post: "success",
  put: "warning",
  delete: "error",
  patch: "secondary",
};

export default function OpenAPITag({ tagName, tagDescription, paths }) {
  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        {tagName}
      </Typography>

      {tagDescription && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          {tagDescription}
        </Typography>
      )}

      {paths.map((p, idx) => (
        <Accordion key={idx} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={2} alignItems="center">
              
              {/* BADGE DEL METODO */}
              <Chip
                label={p.method.toUpperCase()}
                color={METHOD_COLORS[p.method]}
                sx={{ width: 80, fontWeight: 700 }}
              />

              {/* PATH */}
              <Typography fontFamily="monospace" fontWeight={700}>
                {p.path}
              </Typography>

              {/* SUMMARY */}
              <Typography sx={{ opacity: 0.7 }}>{p.summary}</Typography>
            </Stack>
          </AccordionSummary>

          <AccordionDetails>
            <Typography variant="body2">
              {p.description || "No description available."}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
}

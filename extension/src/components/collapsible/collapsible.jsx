import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import "./collapsible.css";

function Collapsible({ title, defaultOpen = true, onChange, expanded, children }) {

  const isControlled = typeof expanded === "boolean";

  return (
    <Accordion 
      {...(isControlled
        ? { expanded, onChange }
        : { defaultExpanded: defaultOpen })}
      className="collapsible">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className="collapsible-title">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails className="collapsible-details">
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

export default Collapsible;

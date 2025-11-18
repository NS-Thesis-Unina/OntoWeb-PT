import './collapsible.css';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/**
 * **Collapsible Component**
 *
 * A wrapper around MUI's Accordion that provides a unified collapsible UI block.
 * Used across the extension to group sections (results, metadata, findings, etc.)
 * into expandable/collapsible containers.
 *
 * Controlled vs Uncontrolled Behavior:
 * - If `expanded` is provided, the component acts as a controlled Accordion.
 * - Otherwise it falls back to MUI's `defaultExpanded` for internal state management.
 *
 * @param {Object} props
 * @param {string} props.title - Section header text.
 * @param {boolean} [props.defaultOpen=true] - Initial expansion state when uncontrolled.
 * @param {(event: any, expanded: boolean) => void} [props.onChange] - Callback for expansion changes.
 * @param {boolean} [props.expanded] - Controls expansion externally when provided.
 * @param {React.ReactNode} props.children - Collapsible content.
 */
function Collapsible({ title, defaultOpen = true, onChange, expanded, children }) {
  const isControlled = typeof expanded === 'boolean';

  return (
    <Accordion
      {...(isControlled ? { expanded, onChange } : { defaultExpanded: defaultOpen })}
      className="collapsible"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className="collapsible-title">{title}</Typography>
      </AccordionSummary>

      <AccordionDetails className="collapsible-details">{children}</AccordionDetails>
    </Accordion>
  );
}

export default Collapsible;

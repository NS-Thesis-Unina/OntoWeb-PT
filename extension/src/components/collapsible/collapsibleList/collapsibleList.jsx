import './collapsibleList.css';
import { Typography } from '@mui/material';
import Collapsible from '../collapsible';

/**
 * **CollapsibleList**
 *
 * A convenience wrapper around <Collapsible /> that renders a simple
 * list (array of strings or renderable values) inside a collapsible block.
 *
 * Typical Usage:
 * - Displaying lists of analyzer rules, messages, extracted libraries, etc.
 *
 * Behavior:
 * - If list has items → renders an unordered list.
 * - If list is empty → renders a “No <title>” message.
 *
 * @param {Object} props
 * @param {boolean} props.defaultOpen - Initial expansion state.
 * @param {boolean} props.expanded - Controlled expansion.
 * @param {string} props.title - Base title text.
 * @param {number} [props.titleCount] - Optional count appended to the title.
 * @param {Array<any>} props.list - Items to display.
 */
function CollapsibleList({ defaultOpen, expanded, title, titleCount, list }) {
  const fullTitle = `${title}${titleCount ? ` (${titleCount})` : ''}`;

  return (
    <Collapsible defaultOpen={defaultOpen} expanded={expanded} title={fullTitle}>
      <div className="collapsiblelist">
        {list.length > 0 ? (
          <ul className="cl-ul">
            {list.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <Typography variant="body2">No {title}</Typography>
        )}
      </div>
    </Collapsible>
  );
}

export default CollapsibleList;

import { Typography } from "@mui/material";
import Collapsible from "../collapsible";
import "./collapsibleList.css";

function CollapsibleList({ defaultOpen, expanded, title, titleCount, list }) {
  return (
    <Collapsible defaultOpen={defaultOpen} expanded={expanded} title={`${title}${titleCount ? ` (${titleCount})` : ""}`}>
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

import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import "./pageNavigation.css";
import { Collapse, Grow, Slide } from "@mui/material";

function PageNavigation({ children, title, icon, subsection }) {

  return (
    <Slide in={true} timeout={200} direction="down">
    <Paper className="pageNavigation-div">
      <div className="icon">
        {icon}
      </div>
      <div className="title">
        <Typography fontWeight="bold" variant="h5">{title}</Typography>
      </div>
      { subsection && (<Divider orientation="vertical" className="divider" />)}
      <div className="subsection">
        <Typography fontWeight="bold" variant="h6">{subsection}</Typography>
      </div>
      <Stack
        className="options"
        direction="row"
        spacing={0}
        divider={<Divider orientation="vertical" flexItem />} 
      >
        {children}
      </Stack>
    </Paper>
    </Slide>
  );
}

export default PageNavigation;

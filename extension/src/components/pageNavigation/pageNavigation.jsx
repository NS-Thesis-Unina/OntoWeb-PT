import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import "./pageNavigation.css";

function PageNavigation({ children, title, icon }) {

  return (
    <Paper className="pageNavigation-div">
      <div className="icon">
        {icon}
      </div>
      <div className="title">
        <Typography fontWeight="bold" variant="h5">{title}</Typography>
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
  );
}

export default PageNavigation;

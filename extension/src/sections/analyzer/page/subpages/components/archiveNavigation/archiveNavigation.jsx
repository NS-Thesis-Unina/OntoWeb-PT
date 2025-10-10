import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import "./archiveNavigation.css";
import { Slide } from "@mui/material";

function ArchiveNavigation({ children }) {

  return (
    <Slide in={true} timeout={300} direction="down">
    <Paper className="archiveNavigation-div">
      <Stack
        className="buttons"
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

export default ArchiveNavigation;

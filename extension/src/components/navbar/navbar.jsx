import "./navbar.css";
import { useNavigate } from "react-router-dom";
import LogoDark from "/images/logo/LogoDark.png";
import LogoLight from "/images/logo/LogoLight.png";
import Button from '@mui/material/Button';
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import DarkLightButton from "../darkLightButton/darkLightButton";
import { useThemeMode } from "../../theme/themeModeProvider";

function Navbar(){

  const { mode } = useThemeMode();
	const navigate = useNavigate();

	return(
		<Paper className="navbar-paper">
      <div className="logo-div">
        <img src={mode === "dark" ? LogoLight : LogoDark} alt="OntoWeb-PT" className="logo" />
      </div>
      <div className="buttons-div">
        <Button className="button" onClick={() => navigate("/home")}>Home</Button>
        <Divider orientation="vertical" />
        <Button onClick={() => navigate("/techstack")}>Technology Stack</Button>
        <Divider orientation="vertical" />
        <Button onClick={() => navigate("/analyzer")}>Analyzer</Button>
      </div>
      <div className="options-div">
        <DarkLightButton />
      </div>
		</Paper>
	)
}

export default Navbar;
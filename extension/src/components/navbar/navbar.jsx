import "./navbar.css";
import { useLocation, useNavigate } from "react-router-dom";
import LogoDark from "/images/logo/LogoDark.png";
import LogoLight from "/images/logo/LogoLight.png";
import Button from '@mui/material/Button';
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import DarkLightButton from "../darkLightButton/darkLightButton";
import { useThemeMode } from "../../theme/themeModeProvider";
import { selectedSection } from "../../libs/navigation";

function Navbar(){

  const { mode } = useThemeMode();
	const navigate = useNavigate();
  const {pathname} = useLocation();

	return(
		<Paper className="navbar-paper">
      <div className="logo-div">
        <img src={mode === "dark" ? LogoLight : LogoDark} alt="OntoWeb-PT" className="logo" />
      </div>
      <div className="buttons-div">
        <Button disabled={selectedSection(pathname, "home")} onClick={() => navigate("/home")}>Home</Button>
        <Divider orientation="vertical" />
        <Button disabled={selectedSection(pathname, "techstack")} onClick={() => navigate("/techstack")}>Technology Stack</Button>
        <Divider orientation="vertical" />
        <Button disabled={selectedSection(pathname, "analyzer")} onClick={() => navigate("/analyzer")}>Analyzer</Button>
        <Divider orientation="vertical" />
        <Button disabled={selectedSection(pathname, "interceptor")} onClick={() => navigate("/interceptor")}>Interceptor</Button>
      </div>
      <div className="options-div">
        <DarkLightButton />
      </div>
		</Paper>
	)
}

export default Navbar;
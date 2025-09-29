import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./techstack.css";
import PageNavigation from "../../../components/pageNavigation/pageNavigation";
import Button from "@mui/material/Button";
import { selectedSubSection } from "../../../libs/navigation";
import LayersIcon from "@mui/icons-material/Layers";

function TechStack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="techstack-div">
      <PageNavigation title={"Technology Stack"} icon={<LayersIcon />}>
        <Button disabled={selectedSubSection(pathname, "techstack", "")} onClick={() => navigate("/techstack")}>Scan</Button>
        <Button disabled={selectedSubSection(pathname, "techstack", "archive")} onClick={() => navigate("/techstack/archive")}>Archive</Button>
      </PageNavigation>
      <Outlet />
    </div>
  );
}

export default TechStack;
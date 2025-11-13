import { Button } from "@mui/material";
import "./archive.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import SubPageNavigation from "../../../../../components/subPageNavigation/subPageNavigation";

function ArchiveAnalyzer() {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnetime = location.pathname.includes("/archive/onetime") || location.pathname.endsWith("/archive");
  const isRuntime = location.pathname.includes("/archive/runtime");

  return (
    <div className="archiveAnalyzer-div">
      <SubPageNavigation>
        <Button disabled={isOnetime} onClick={() => navigate("onetime")}>One-Time Scan</Button>
        <Button disabled={isRuntime} onClick={() => navigate("runtime")}>Runtime Scan</Button>
      </SubPageNavigation>
      <Outlet />
    </div>
  );
}

export default ArchiveAnalyzer;

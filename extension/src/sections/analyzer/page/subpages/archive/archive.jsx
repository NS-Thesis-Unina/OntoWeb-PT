import { Button } from "@mui/material";
import ArchiveNavigation from "../components/archiveNavigation/archiveNavigation";
import "./archive.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

function ArchiveAnalyzer() {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnetime = location.pathname.includes("/archive/onetime") || location.pathname.endsWith("/archive");
  const isRuntime = location.pathname.includes("/archive/runtime");

  return (
    <div className="archiveAnalyzer-div">
      <ArchiveNavigation>
        <Button disabled={isOnetime} onClick={() => navigate("onetime")}>One-Time Scan</Button>
        <Button disabled={isRuntime} onClick={() => navigate("runtime")}>Runtime Scan</Button>
      </ArchiveNavigation>
      <Outlet />
    </div>
  );
}

export default ArchiveAnalyzer;

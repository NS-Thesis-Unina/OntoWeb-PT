import { Button } from "@mui/material";
import "./analyze.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import SubPageNavigation from "../../../../../components/subPageNavigation/subPageNavigation";

function AnalyzeAnalyzer() {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnetime = location.pathname.includes("/analyze/onetime") || location.pathname.endsWith("/analyze");
  const isRuntime = location.pathname.includes("/analyze/runtime");

  return (
    <div className="analyzeAnalyzer-div">
      <SubPageNavigation>
        <Button disabled={isOnetime} onClick={() => navigate("onetime")}>One-Time Scan</Button>
        <Button disabled={isRuntime} onClick={() => navigate("runtime")}>Runtime Scan</Button>
      </SubPageNavigation>
      <Outlet />
    </div>
  );
}

export default AnalyzeAnalyzer;

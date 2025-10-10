import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./analyzer.css";
import PageNavigation from "../../../components/pageNavigation/pageNavigation";
import { selectedSubSection } from "../../../libs/navigation";
import { Button } from "@mui/material";
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { useEffect, useEffect, useState } from "react";

function Analyzer() {
  const navigate = useNavigate();
  const {pathname} = useLocation();
  const [subsection, setSubsection] = useState("");

  useEffect(() => {
    if (pathname === "/analyzer/runtime") {
      setSubsection("Runtime Scan");
    } else if (pathname.startsWith("/analyzer/archive")) {
      setSubsection("Archive");
    } else {
      setSubsection("One-Time Scan");
    }
  }, [pathname]);

  return (
    <div className="analyzer-div">
      <PageNavigation title={"Analyzer"} icon={<AnalyticsIcon />} subsection={subsection}>
        <Button disabled={selectedSubSection(pathname, "analyzer", "")} onClick={() => navigate("/analyzer")}>One-Time Scan</Button>
        <Button disabled={selectedSubSection(pathname, "analyzer", "runtime")} onClick={() => navigate("/analyzer/runtime")}>Runtime Scan</Button>
        <Button disabled={selectedSubSection(pathname, "analyzer", "archive")} onClick={() => navigate("/analyzer/archive")}>Archive</Button>
      </PageNavigation>
      <Outlet />
    </div>
  );
}

export default Analyzer;

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./analyzer.css";
import PageNavigation from "../../../components/pageNavigation/pageNavigation";
import { selectedSubSection } from "../../../libs/navigation";
import { Button } from "@mui/material";
import AnalyticsIcon from '@mui/icons-material/Analytics';

function Analyzer() {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  return (
    <div className="analyzer-div">
      <PageNavigation title={"Analyzer"} icon={<AnalyticsIcon />}>
        <Button disabled={selectedSubSection(pathname, "analyzer", "")} onClick={() => navigate("/analyzer")}>One-Time Scan</Button>
        <Button disabled={selectedSubSection(pathname, "analyzer", "runtime")} onClick={() => navigate("/analyzer/runtime")}>Runtime Scan</Button>
        <Button disabled={selectedSubSection(pathname, "analyzer", "archive")} onClick={() => navigate("/analyzer/archive")}>Archive</Button>
      </PageNavigation>
      <Outlet />
    </div>
  );
}

export default Analyzer;

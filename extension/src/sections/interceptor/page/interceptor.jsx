import { Outlet, useLocation, useNavigate } from "react-router-dom";
import "./interceptor.css";
import PageNavigation from "../../../components/pageNavigation/pageNavigation";
import Button from "@mui/material/Button";
import { selectedSubSection } from "../../../libs/navigation";
import PodcastsIcon from '@mui/icons-material/Podcasts';
import { useEffect, useState } from "react";

function Interceptor() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [subsection, setSubsection] = useState("");

  useEffect(() => {
    switch(pathname){
      case "/interceptor/archive": {
        setSubsection("Archive");
        break;
      }
      case "/interceptor/send": {
        setSubsection("Send to Ontology");
        break;
      }
      default: setSubsection("Runtime Scan");
    }
  },[pathname])

  return (
    <div className="interceptor-div">
      <PageNavigation title={"Interceptor"} icon={<PodcastsIcon />} subsection={subsection}>
        <Button disabled={selectedSubSection(pathname, "interceptor", "")} onClick={() => navigate("/interceptor")}>Runtime Scan</Button>
        <Button disabled={selectedSubSection(pathname, "interceptor", "send")} onClick={() => navigate("/interceptor/send")}>Send to ontology</Button>
        <Button disabled={selectedSubSection(pathname, "interceptor", "archive")} onClick={() => navigate("/interceptor/archive")}>Archive</Button>
      </PageNavigation>
      <Outlet />
    </div>
  );
}

export default Interceptor;
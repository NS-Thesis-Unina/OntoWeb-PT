import "./home.css";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { Paper, Zoom } from "@mui/material";
import HomeCard from "./components/homeCard/homeCard";
import LayersIcon from "@mui/icons-material/Layers";
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PodcastsIcon from '@mui/icons-material/Podcasts';


function Home(){

  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowCards(true);
    },200);
  },[])

  return(
      <div className="home-div">
        <Paper className="description">
          <Zoom in={true}>
            <Typography variant="body2">
              <strong>OntoWeb-PT</strong> is an extension designed to support penetration testing activities: 
              it automatically gathers relevant information from web pages and presents it in a structured way. 
              It connects to a dedicated ontology to provide contextual suggestions and enhanced insights.
              It reduces manual reconnaissance work and facilitates the preparation of analyses and reports.
              {" "}<u>Use only on authorized targets.</u>
            </Typography>
          </Zoom>
        </Paper>
        <div className="cards">
          <HomeCard title={"Technology Stack"} 
          content={"The Technology Stack section automatically identifies the technologies, frameworks, and services used by a web page (client libraries, server, CMS, WAF, etc.) and provides evidence and useful details for analysis."}
          show={showCards}
          icon={<LayersIcon />}
          pathname="/techstack"
          />
          <HomeCard title={"Analyzer"} 
          content={"The Analyzer performs a detailed inspection of the page (extracting DOM, metadata, headings, forms, links, scripts, media, and statistics) and generates a structured report to facilitate anomaly detection and support testing."}
          show={showCards}
          delay={30}
          icon={<AnalyticsIcon />}
          pathname="/analyzer"
          />
          <HomeCard title={"Interceptor"} 
          content={"The Interceptor captures and logs all network activity within the page context (including fetch, XMLHttpRequest, and other network APIs), recording request and response data such as headers, bodies, status codes, and timing."}
          show={showCards}
          delay={60}
          icon={<PodcastsIcon />}
          pathname="/interceptor"
          />
        </div>
      </div>
  )
}

export default Home;
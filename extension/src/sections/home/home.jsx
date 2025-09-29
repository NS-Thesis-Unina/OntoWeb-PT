import "./home.css";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import LogoDark from "/images/logo/LogoDark.png";
import LogoLight from "/images/logo/LogoLight.png";
import { useThemeMode } from "../../theme/themeModeProvider";
import { Paper, Zoom } from "@mui/material";
import HomeCard from "./components/homeCard/homeCard";
import LayersIcon from "@mui/icons-material/Layers";
import AnalyticsIcon from '@mui/icons-material/Analytics';


function Home(){

  const {mode} = useThemeMode();
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowCards(true);
    },200);
  },[])

  return(
      <div className="home-div">
        <div className="logo">
          <Zoom in={true}>
            <img alt="OntoWeb-PT" src={mode === "dark" ? LogoLight : LogoDark} />
          </Zoom>
        </div>
        <Paper className="description">
          <Zoom in={true}>
            <Typography variant="body2">
              <strong>OntoWeb-PT</strong> è un'estensione pensata per supportare attività di penetration testing: 
              acquisisce automaticamente informazioni rilevanti dalle pagine web e le presenta in modo strutturato. 
              Si collega a un'ontologia dedicata per offrire suggerimenti contestuali e approfondimenti migliorati. 
              <br />
              Riduce il lavoro manuale di ricognizione e facilita la preparazione di analisi e report; <u>usare solo su target autorizzati.</u>
            </Typography>
          </Zoom>
        </Paper>
        <div className="cards">
          <HomeCard title={"Technology Stack"} 
          content={"La sezione Technology Stack identifica automaticamente le tecnologie, framework e servizi usati da una pagina web (librerie client, server, CMS, WAF, ecc.) e fornisce evidenze e dettagli utili per l’analisi."}
          show={showCards}
          icon={<LayersIcon />}
          pathname="/techstack"
          />
          <HomeCard title={"Analyzer"} 
          content={"L'Analyzer esegue un'ispezione dettagliata della pagina (estrae DOM, meta, heading, form, link, script, media e statistiche) e produce un report strutturato per facilitare l'identificazione di anomalie e supportare i test."}
          show={showCards}
          delay={30}
          icon={<AnalyticsIcon />}
          pathname="/analyzer"
          />
          <HomeCard title={"Coming soon..."} 
          content={"Sezione in via di sviluppo."}
          show={showCards}
          delay={60}
          />
        </div>
      </div>
  )
}

export default Home;
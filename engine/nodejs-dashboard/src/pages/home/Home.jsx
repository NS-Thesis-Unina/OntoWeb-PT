import { Paper, Stack, Typography, Button, Divider } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import SearchIcon from '@mui/icons-material/Search';
import LanIcon from '@mui/icons-material/Lan';

import './home.css';

export default function Home() {

  return (
    <div className="home-container">

      {/* Intro */}
      <Paper className="home-section intro-section" elevation={3}>
        <Typography variant="h4" className="title">
          OntoWeb-PT
        </Typography>

        <Typography variant="body1" className="description">
          OntoWeb-PT è uno strumento progettato per supportare attività di penetration testing. 
          Raccoglie automaticamente informazioni dalle pagine web, utilizza un'ontologia dedicata 
          per arricchire i dati e genera report strutturati per supportare l’analisi.
        </Typography>

        <Typography variant="body2" className="warning">
          ⚠️ Utilizzare solo su target autorizzati.
        </Typography>
      </Paper>


      {/* Cards principali */}
      <Stack direction="row" spacing={3} className="cards-row">
        
        <Paper className="feature-card" onClick={() => window.location.href='/findings/techstack'}>
          <BuildIcon className="feature-icon" />
          <Typography variant="h6">Technology Stack</Typography>
          <Typography variant="body2">
            Analizza librerie, framework, CMS, server e WAF rilevati nelle pagine.
          </Typography>
        </Paper>

        <Paper className="feature-card" onClick={() => window.location.href='/findings/analyzer'}>
          <SearchIcon className="feature-icon" />
          <Typography variant="h6">Analyzer</Typography>
          <Typography variant="body2">
            Estrae DOM, metadata, headings, forms, links, script e anomalie.
          </Typography>
        </Paper>

        <Paper className="feature-card" onClick={() => window.location.href='/http-requests'}>
          <LanIcon className="feature-icon" />
          <Typography variant="h6">Interceptor</Typography>
          <Typography variant="body2">
            Registra richieste HTTP, headers, corpo e tempi di risposta.
          </Typography>
        </Paper>

      </Stack>

    </div>
  );
}

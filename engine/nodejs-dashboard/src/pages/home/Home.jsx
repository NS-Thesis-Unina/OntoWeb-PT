import './home.css';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Paper, Zoom } from '@mui/material';

import HomeCard from './components/homeCard';

// Icons
import HttpIcon from '@mui/icons-material/Http';
import BugReportIcon from '@mui/icons-material/BugReport';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ApiIcon from '@mui/icons-material/Api';

function Home() {
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCards(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="home-div">
      
      {/* INTRO */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>OntoWeb-PT</strong> è uno strumento progettato per supportare 
            attività di penetration testing raccogliendo informazioni dalle pagine web,
            analizzandole tramite un’ontologia dedicata e producendo risultati strutturati.
            <br />
            Questa console permette di consultare e gestire i dati elaborati dal backend:
            richieste HTTP, findings, PCAP, stato dei servizi e API.
            <br />
            <u>Use only on authorized targets.</u>
          </Typography>
        </Zoom>
      </Paper>

      {/* CARDS */}
      <div className="cards">

        {/* HTTP REQUESTS */}
        <HomeCard
          title="HTTP Requests"
          content={
            'Visualizza tutte le richieste HTTP catturate dall’estensione e memorizzate ' +
            'nell’ontologia, includendo headers, metodi, corpi, status code e timing.'
          }
          show={showCards}
          icon={<HttpIcon />}
          pathname="/http-requests"
        />

        {/* FINDINGS */}
        <HomeCard
          title="Findings"
          content={
            'Raccoglie tutti i rilevamenti individuati: vulnerabilità HTTP, anomalie DOM ' +
            'dell’Analyzer e rischi del Technology Stack, suddivisi in tre sottosezioni.'
          }
          show={showCards}
          delay={30}
          icon={<BugReportIcon />}
          pathname="/findings"
        />

        {/* SEND PCAP */}
        <HomeCard
          title="Send PCAP"
          content={
            'Permette di caricare file PCAP, estrarre le richieste HTTP presenti e inviarle ' +
            'all’ontologia per eseguire analisi anche su traffico offline.'
          }
          show={showCards}
          delay={60}
          icon={<SendIcon />}
          pathname="/send-pcap"
        />

        {/* TOOL STATUS */}
        <HomeCard
          title="Tool Status"
          content={
            'Offre una panoramica sullo stato dei servizi del backend e della connessione ' +
            'con il WebSocket dell’estensione, utile per diagnosticare problemi operativi.'
          }
          show={showCards}
          delay={90}
          icon={<CheckCircleIcon />}
          pathname="/server-status"
        />

        {/* API EXPLORER */}
        <HomeCard
          title="OpenAPI"
          content={
            'Interfaccia interattiva per esplorare gli endpoint del backend, testare richieste ' +
            'e consultare la documentazione generata automaticamente.'
          }
          show={showCards}
          delay={120}
          icon={<ApiIcon />}
          pathname="/openapi"
        />
      </div>
    </div>
  );
}

export default Home;

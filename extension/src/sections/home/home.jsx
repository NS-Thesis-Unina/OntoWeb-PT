import './home.css';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Paper, Zoom } from '@mui/material';
import HomeCard from './components/homeCard/homeCard';
import LayersIcon from '@mui/icons-material/Layers';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PodcastsIcon from '@mui/icons-material/Podcasts';

/**
 * **Page: Home**
 *
 * Architectural Role:
 *   This component acts as the landing page of the OntoWeb-PT browser extension.
 *
 * Purpose:
 *   - Introduces the user to the three main functional modules:
 *       1) Technology Stack
 *       2) Analyzer
 *       3) Interceptor
 *   - Displays animated cards that guide the user to each section.
 *   - Shows an introductory block explaining the goal and scope of the extension.
 *
 * UX Notes:
 *   - Cards appear with a small delay after mount (fade-in effect).
 *   - Each card links to a dedicated feature page.
 *   - Uses MUI Paper + Zoom for smooth presentation.
 *
 * Security Reminder:
 *   - The text includes an explicit note: *use only on authorized targets*.
 */
function Home() {
  /**
   * showCards:
   * Controls the delayed appearance of the feature cards.
   * - Initially false → cards hidden
   * - After 200ms → cards fade in via internal animation of `HomeCard`
   */
  const [showCards, setShowCards] = useState(false);

  /**
   * Side-effect: enable card animation shortly after the component mounts.
   * Adds a minimal entrance delay to avoid abrupt content pop-in.
   */
  useEffect(() => {
    const t = setTimeout(() => setShowCards(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="home-div">
      {/* Introductory description block */}
      <Paper className="description">
        <Zoom in={true}>
          <Typography variant="body2">
            <strong>OntoWeb-PT</strong> is an extension designed to support penetration testing
            activities: it automatically gathers relevant information from web pages and presents it
            in a structured way. It connects to a dedicated ontology to provide contextual
            suggestions and enhanced insights. It reduces manual reconnaissance work and facilitates
            the preparation of analyses and reports. <u>Use only on authorized targets.</u>
          </Typography>
        </Zoom>
      </Paper>

      {/* Section with the 3 feature cards */}
      <div className="cards">
        {/* Feature: Technology Stack */}
        <HomeCard
          title={'Technology Stack'}
          content={
            'The Technology Stack section automatically identifies the technologies, ' +
            'frameworks, and services used by a web page (client libraries, server, CMS, ' +
            'WAF, etc.) and provides evidence and useful details for analysis.'
          }
          show={showCards}
          icon={<LayersIcon />}
          pathname="/techstack"
        />

        {/* Feature: Analyzer */}
        <HomeCard
          title={'Analyzer'}
          content={
            'The Analyzer performs a detailed inspection of the page (extracting DOM, ' +
            'metadata, headings, forms, links, scripts, media, and statistics) and generates ' +
            'a structured report to facilitate anomaly detection and support testing.'
          }
          show={showCards}
          delay={30}
          icon={<AnalyticsIcon />}
          pathname="/analyzer"
        />

        {/* Feature: Interceptor */}
        <HomeCard
          title={'Interceptor'}
          content={
            'The Interceptor captures and logs all network activity within the page context ' +
            '(including fetch, XMLHttpRequest, and other network APIs), recording request and ' +
            'response data such as headers, bodies, status codes, and timing.'
          }
          show={showCards}
          delay={60}
          icon={<PodcastsIcon />}
          pathname="/interceptor"
        />
      </div>
    </div>
  );
}

export default Home;

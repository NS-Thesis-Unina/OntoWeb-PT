import { Paper, Typography } from "@mui/material";
import HttpIcon from "@mui/icons-material/Http";
import BugReportIcon from "@mui/icons-material/BugReport";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ApiIcon from "@mui/icons-material/Api";
import { useNavigate } from 'react-router-dom';

import "./home.css";

function Home() {

  const navigate = useNavigate();

  const navigateTo = (path) => {
    navigate(path);
  };

  return (
    <div className="home-div">
      <Paper className="home-section intro-section" elevation={3}>
        <Typography variant="h4" className="title">
          OntoWeb-PT
        </Typography>

        <Typography variant="body1" className="description">
          OntoWeb-PT is a web penetration testing assistant that collects HTTP
          traffic and metadata, maps them into a dedicated security ontology,
          and turns raw noise into structured, queryable knowledge. It is
          designed to sit alongside your existing toolkit and give you a clear,
          navigable view of how a target application behaves over the wire.
        </Typography>

        <Typography variant="body1" className="description">
          From low-level HTTP requests to high-level findings, OntoWeb-PT helps
          you explore technologies, detect weak configurations, and document
          your assessments in a consistent way. Use it as a companion during
          manual testing sessions or as a backend for automated pipelines.
        </Typography>

        <Typography variant="body2" className="warning">
          ⚠️ Use OntoWeb-PT only against systems and targets you are explicitly
          authorized to test.
        </Typography>
      </Paper>

      <div className="cards-row">
        <Paper
          className="feature-card"
          elevation={2}
          onClick={() => navigateTo("/http-requests")}
        >
          <div className="title-card">
            <HttpIcon className="feature-icon" />
            <Typography variant="h1">Requests</Typography>
          </div>
          <Typography variant="body2">
            Browse all HTTP requests stored in GraphDB. Filter by method, URL,
            scheme, authority, or full-text search, and open the detailed view
            to inspect request and response headers, bodies, and connection
            metadata.
          </Typography>
        </Paper>

        <Paper
          className="feature-card"
          elevation={2}
          onClick={() => navigateTo("/findings")}
        >
          <div className="title-card">
            <BugReportIcon className="feature-icon" />
            <Typography variant="h1">Findings</Typography>
          </div>
          <Typography variant="body2">
            Explore potential vulnerabilities and misconfigurations inferred
            from your traffic. Techstack findings highlight technology and
            security-header issues, while analyzer findings focus on HTML
            components and interceptor findings are tied directly to captured
            HTTP requests.
          </Typography>
        </Paper>

        <Paper
          className="feature-card"
          elevation={2}
          onClick={() => navigateTo("/send-pcap")}
        >
          <div className="title-card">
            <SendIcon className="feature-icon" />
            <Typography variant="h1">Send PCAP</Typography>
          </div>
          <Typography variant="body2">
            Upload PCAP files, extract HTTP flows, and selectively import the
            requests you care about. Optionally push them through the resolver
            to enrich data and surface suspicious behaviors or weak spots in the
            observed traffic.
          </Typography>
        </Paper>

        <Paper
          className="feature-card"
          elevation={2}
          onClick={() => navigateTo("/server-status")}
        >
          <div className="title-card">
            <CheckCircleIcon className="feature-icon" />
            <Typography variant="h1">Tool Status</Typography>
          </div>
          <Typography variant="body2">
            Monitor the overall health of the platform, including the Node.js
            backend, GraphDB, and the real-time socket connection. Quickly
            verify that everything is up and running before starting a new
            analysis or sending fresh traffic.
          </Typography>
        </Paper>

        <Paper
          className="feature-card"
          elevation={2}
          onClick={() => navigateTo("/openapi")}
        >
          <div className="title-card">
            <ApiIcon className="feature-icon" />
            <Typography variant="h1">OpenAPI</Typography>
          </div>
          <Typography variant="body2">
            Discover the REST APIs exposed by OntoWeb-PT. Inspect endpoints,
            payload structures, and example calls so you can integrate the tool
            into your own scripts, CI pipelines, or custom dashboards.
          </Typography>
        </Paper>
      </div>
    </div>
  );
}

export default Home;

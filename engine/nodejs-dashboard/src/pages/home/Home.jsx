import { Paper, Typography, Zoom } from "@mui/material";
import HttpIcon from "@mui/icons-material/Http";
import BugReportIcon from "@mui/icons-material/BugReport";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ApiIcon from "@mui/icons-material/Api";

import "./home.css";
import HomeCard from "./components/homeCard/homeCard";

function Home() {
  return (
    <div className="home-div">
      <Zoom in={true}>
        <Paper className="home-section intro-section">
          <Typography variant="h4" className="title">
            OntoWeb-PT Dashboard
          </Typography>

          <Typography variant="body1" className="description">
            OntoWeb-PT is a web penetration testing assistant that ingests HTTP
            traffic from different sources (browser interceptor, PCAP imports
            and automation), normalises it and stores it in a security ontology
            backed by GraphDB. It turns noisy network captures into structured,
            queryable objects that you can explore and correlate across
            requests, technologies and findings.
          </Typography>

          <Typography variant="body1" className="description">
            On top of this knowledge graph, dedicated resolvers (HTTP,
            Techstack and HTML Analyzer) derive higher-level findings about
            misconfigurations, weak controls and risky patterns. Use the
            sections below to browse raw HTTP requests, review findings,
            import traffic from PCAP, check the health of the backend and
            inspect the public REST API.
          </Typography>
        </Paper>
      </Zoom>

      <div className="cards-row">
        <HomeCard
          show={true}
          delay={0}
          path="/http-requests"
          icon={<HttpIcon className="feature-icon" />}
          title="Requests"
          description={`Browse all HTTP requests that have been ingested into GraphDB. 
            Use server-side filters for method, scheme, authority, path and full-text 
            search to narrow down the traffic, then open any row to inspect the 
            normalised URI, structured query parameters, request headers, response 
            headers and the (base64) response body associated with that request.`}
        />

        <HomeCard
          show={true}
          delay={100}
          path="/findings"
          icon={<BugReportIcon className="feature-icon" />}
          title="Findings"
          description={`Explore all security findings derived from your traffic and HTML 
            analysis. Techstack findings focus on detected technologies, WAFs, security 
            headers and cookies (with CPE/CVE enrichment when available). HTTP findings 
            describe protocol-level issues extracted from individual requests, while 
            Analyzer findings highlight suspicious HTML and script fragments with 
            OWASP mapping and remediation hints.`}
        />

        <HomeCard
          show={true}
          delay={200}
          path="/send-pcap"
          icon={<SendIcon className="feature-icon" />}
          title="Send PCAP"
          description={`Follow a guided wizard to upload a PCAP/PCAPNG file together 
            with its TLS key log, decrypt and extract HTTP/1.x and HTTP/2 requests, 
            preview the decoded traffic and select only the flows you care about. 
            The chosen requests are converted into ontology-ready items and sent 
            to the backend, where you can optionally enable the resolver and 
            monitor the resulting jobs in real time.`}
        />

        <HomeCard
          show={true}
          delay={300}
          path="/server-status"
          icon={<CheckCircleIcon className="feature-icon" />}
          title="Tool Status"
          description={`Check the current health of the OntoWeb-PT backend before 
            starting an analysis. This view queries the Node.js API, worker queues 
            and GraphDB/SPARQL endpoint, summarising whether the analysis tool is 
            ON, reachable and ready to accept new HTTP traffic or resolver jobs.`}
        />

        <HomeCard
          show={true}
          delay={400}
          path="/openapi"
          icon={<ApiIcon className="feature-icon" />}
          title="OpenAPI"
          description={`Explore the REST APIs exposed by the Node.js backend. The 
            OpenAPI explorer groups endpoints by tag, shows methods, paths, 
            summaries and descriptions, and expands into the resolved request/response 
            JSON schemas, so you can integrate OntoWeb-PT into scripts, CI pipelines 
            or custom dashboards with accurate contract documentation.`}
        />
      </div>
    </div>
  );
}

export default Home;

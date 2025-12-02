import { Routes, Route } from 'react-router-dom';
import Home from './pages/home/home';
import OpenAPI from './pages/openApi/openApi';
import App from './app';
import HttpRequests from './pages/httpRequests/httpRequests';
import HttpFindings from './pages/findings/httpFindings/httpFindings';
import AnalyzerFindings from './pages/findings/analyzerFindings/analyzerFindings';
import TechstackFindings from './pages/findings/techstackFindings/techstackFindings';
import SendPcap from './pages/sendPcap/sendPcap';
import ServerStatusPage from './pages/status/serverStatusPage';

function Router() {

  return (
    <Routes>
      <Route path="/" element={<App />}>

        <Route index element={<Home />} />
        <Route path="home" element={<Home />} />


        <Route path="http-requests" element={<HttpRequests />} />


        <Route path="findings">
          <Route index element={<HttpFindings />} />
          <Route path="analyzer" element={<AnalyzerFindings />} />
          <Route path="techstack" element={<TechstackFindings />} />
        </Route>

        <Route path="server-status" element={<ServerStatusPage />} />

        <Route path="send-pcap" element={<SendPcap />} />

        <Route path="openapi" element={<OpenAPI />} />
      </Route>
    </Routes>
  );
}

export default Router;

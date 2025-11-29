import { Routes, Route } from 'react-router-dom';
import Home from './pages/home/home';
import App from './app';
import HttpRequests from './pages/httpRequests/httpRequests';

function Router() {

  return (
    <Routes>
      <Route path="/" element={<App />}>

        <Route index element={<Home />} />
        <Route path="home" element={<Home />} />


        <Route path="http-requests" element={<HttpRequests />} />


        <Route path="findings">
          <Route index element={<h1>Http Findings</h1>} />
          <Route path="analyzer" element={<h1>Analyzer Findings</h1>} />
          <Route path="techstack" element={<h1>Techstack Findings</h1>} />
        </Route>

        <Route path="server-status" element={<h1>Server Status</h1>} />

        <Route path="send-pcap" element={<h1>Send PCAP</h1>} />

        <Route path="openapi" element={<h1>OpenAPI</h1>} />
      </Route>
    </Routes>
  );
}

export default Router;

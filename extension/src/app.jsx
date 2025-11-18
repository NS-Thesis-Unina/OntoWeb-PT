import './app.css';
import { Outlet } from 'react-router-dom';
import Navbar from './components/navbar/navbar';
import RoutePersistence from './routePersistence';

/**
 * **App Component**
 *
 * This component defines the top-level layout for the UI inside the browser
 * extension popup. It wraps the main navigation bar and renders the active
 * route via <Outlet />, which is populated by React Router.
 *
 * Architectural Notes:
 * - <Navbar /> provides the main navigation between Analyzer, TechStack,
 *   Interceptor, and other sections.
 * - <RoutePersistence /> ensures that the UI restores the last visited page
 *   when the popup is reopened, maintaining navigation state across sessions.
 * - <Outlet /> renders whichever page is currently active based on the router.
 *
 * This layout is used as a wrapper for all nested routes defined in router.jsx.
 * Acts as the main container for the extension UI. It includes navigation,
 * persistent routing behavior, and a content area where child routes are rendered.
 *
 * @returns {JSX.Element} The main application layout.
 */
function App() {
  return (
    <div className="app-div">
      {/* Restores last visited route when opening the popup */}
      <RoutePersistence />

      {/* Global navigation bar */}
      <Navbar />

      {/* Area where nested routes are rendered */}
      <div className="page-div">
        <Outlet />
      </div>
    </div>
  );
}

export default App;

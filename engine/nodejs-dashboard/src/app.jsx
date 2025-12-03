import './app.css';
import { Outlet } from 'react-router-dom';
import NavigationWrapper from './components/navigationWrapper/navigationWrapper';

/**
 * App Layout Wrapper
 *
 * Architectural Role:
 * - Provides the top-level UI shell for all routed pages.
 * - Hosts global navigation chrome via <NavigationWrapper />.
 * - Renders the active child route using React Router's <Outlet />.
 *
 * Responsibilities:
 * - Keep page layout consistent across sections.
 * - Centralize shared UI elements (e.g., header/side nav) in one place.
 *
 * UX Notes:
 * - Children control their own content area; the wrapper focuses on layout and navigation.
 *
 * @returns {JSX.Element} The application layout that wraps all nested routes.
 */
function App() {
  return (
    <div className="app-div">
      {/* Global navigation + frame; renders children inside */}
      <NavigationWrapper>
        {/* Nested route content is injected here */}
        <Outlet />
      </NavigationWrapper>
    </div>
  );
}

export default App;

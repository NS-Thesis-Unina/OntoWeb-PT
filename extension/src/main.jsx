/**
 * Application Entry Point
 *
 * This file mounts the React application inside the extension's popup UI.
 * It sets up the global providers responsible for:
 *
 * - ThemeModeProvider: manages light/dark mode and exposes theme context.
 * - SnackbarProvider: global toast notification system (based on notistack).
 * - HashRouter: routing system suitable for browser extensions where URLs
 *   must not rely on server-side path resolution.
 *
 * Architectural Notes:
 * - HashRouter is used instead of BrowserRouter because browser extensions
 *   run in a sandboxed environment without server-side route handling.
 * - All high-level UI context providers should be initialized here.
 */

import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import Router from './router';
import ThemeModeProvider from './theme/themeModeProvider';
import { SnackbarProvider } from 'notistack';

// Get the root DOM node where React will be mounted
const root = document.getElementById('root');

/**
 * Render the entire React UI.
 *
 * The component tree is wrapped with the required global providers and
 * then passed to ReactDOM for rendering.
 */
createRoot(root).render(
  <ThemeModeProvider defaultMode="dark">
    {/* Global notification system (snackbars / toasts) */}
    <SnackbarProvider maxSnack={1} anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
      {/* Hash-based routing suitable for browser extensions */}
      <HashRouter>
        <Router />
      </HashRouter>
    </SnackbarProvider>
  </ThemeModeProvider>
);

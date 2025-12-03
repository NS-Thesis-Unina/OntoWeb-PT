/**
 * Application Entry Point
 *
 * Bootstraps the React app and wires up global providers:
 * - ThemeModeProvider: supplies light/dark theme context (default: dark).
 * - SnackbarProvider (notistack): global toasts/notifications.
 * - BrowserRouter: HTML5 history-based routing for deep links & navigation.
 * - <Router />: the application route map rendered under the providers.
 *
 * Notes:
 * - Keep provider order stable to avoid unnecessary re-mounts.
 * - The imported CSS ('index.css') applies global resets and base styles.
 */

import { createRoot } from 'react-dom/client';
import './index.css';
import ThemeModeProvider from './theme/themeModeProvider';
import { SnackbarProvider } from 'notistack';
import Router from './router.jsx';
import { BrowserRouter, Routes } from 'react-router-dom'; // Routes is currently unused but harmless.

/**
 * Mount the React app onto the #root container and compose global context.
 */
createRoot(document.getElementById('root')).render(
  // App-wide theme context (persisting and toggling color scheme)
  <ThemeModeProvider defaultMode="dark">
    {/* Global snackbars; limit concurrency to avoid stacking noise */}
    <SnackbarProvider maxSnack={1} anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}>
      {/* Client-side routing with clean URLs */}
      <BrowserRouter>
        {/* The route tree (see router.jsx) */}
        <Router />
      </BrowserRouter>
    </SnackbarProvider>
  </ThemeModeProvider>
);

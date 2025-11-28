import { createRoot } from 'react-dom/client'
import './index.css'
import ThemeModeProvider from './theme/themeModeProvider';
import { SnackbarProvider } from 'notistack';
import Router from './router.jsx';
import { BrowserRouter, Routes } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <ThemeModeProvider defaultMode='dark'>
    <SnackbarProvider maxSnack={1} anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </SnackbarProvider>
  </ThemeModeProvider>
)

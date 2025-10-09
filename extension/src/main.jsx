import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import Router from "./router";
import ThemeModeProvider from "./theme/themeModeProvider";
import { SnackbarProvider } from 'notistack';

const root = document.getElementById("root");
createRoot(root).render(
  <ThemeModeProvider defaultMode="dark">
    <SnackbarProvider maxSnack={1} anchorOrigin={{horizontal: "center", vertical: "bottom"}}>
      <HashRouter>
        <Router />
      </HashRouter>
    </SnackbarProvider>
  </ThemeModeProvider>
);
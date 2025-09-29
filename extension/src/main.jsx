import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import Router from "./router";
import ThemeModeProvider from "./theme/themeModeProvider";

const root = document.getElementById("root");
createRoot(root).render(
  <ThemeModeProvider defaultMode="dark">
    <HashRouter>
      <Router />
    </HashRouter>
  </ThemeModeProvider>
);
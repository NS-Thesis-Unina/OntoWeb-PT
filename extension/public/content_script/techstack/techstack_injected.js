const api = typeof browser !== "undefined" ? browser : chrome;

// Data collection function
function collectTechStackData() {
  const MAX_HTML = 300_000;
  const MAX_INLINE_SCRIPTS = 12;
  const MAX_SCRIPT_CHARS = 30_000;

  // --- META TAGS ---
  const meta = Array.from(document.querySelectorAll("meta")).map(m => ({
    name: m.getAttribute("name"),
    property: m.getAttribute("property"),
    content: m.getAttribute("content"),
  }));

  // --- SCRIPTS ---
  const scriptSrc = Array.from(document.scripts).map(s => s.src).filter(Boolean);

  const scripts = Array.from(document.scripts)
    .filter(s => !s.src && s.textContent)
    .slice(0, MAX_INLINE_SCRIPTS)
    .map(s => s.textContent.substring(0, MAX_SCRIPT_CHARS));

  // --- HTML + URL ---
  const html = document.documentElement.outerHTML.substring(0, MAX_HTML);
  const url = location.href;

  // --- Optional Findings ---
  const domFindings = [];
  const jsFindings = [];

  return { meta, scriptSrc, scripts, html, url, domFindings, jsFindings };
}

// Listener for messages from the background script
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeStack") {
    try {
      const payload = collectTechStackData();
      sendResponse({ ok: true, info: payload });
    } catch (err) {
      console.error("[TechStack Injected] Errore:", err);
      sendResponse({ ok: false, error: String(err) });
    }
    return true; 
  }

  if (message.action === "dumpLocalStorage") {
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      items.push({ key, value: localStorage.getItem(key) });
    }
    sendResponse(items);
    return true;
  }

  if (message.action === "dumpSessionStorage") {
    const items = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      items.push({ key, value: sessionStorage.getItem(key) });
    }
    sendResponse(items);
    return true;
  }

  return false;
});

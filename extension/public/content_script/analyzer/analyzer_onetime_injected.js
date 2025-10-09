(function () {
  const apiX = typeof browser !== "undefined" ? browser : chrome;

  (async () => {
    try {
      const html = document.documentElement.outerHTML;

      const response = await apiX.runtime.sendMessage({
        type: "analyzer_scanResult",
        data: { html }
      });

      console.log("[Analyzer/ContentScript-OneTime] ACK from background:", response);
    } catch (err) {
      console.error("[Analyzer/ContentScript-OneTime] Error sending HTML:", err);
    }
  })();
})();

(function () {
  const apiX = typeof browser !== "undefined" ? browser : chrome;

  try {
    const payload = {
      html: document.documentElement.outerHTML,
      url: location.href,
      title: document.title,
      timestamp: Date.now()
    };
    apiX.runtime.sendMessage({ type: "analyzer_runtimeScanResult", data: payload }).catch(() => {});
  } catch (err) {
    // ignore
  }
})();

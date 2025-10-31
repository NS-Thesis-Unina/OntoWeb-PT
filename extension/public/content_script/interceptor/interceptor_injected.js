(function(){
  const apiX = typeof browser !== "undefined" ? browser : chrome;

  // 1) Inject page-world script
  try {
    const script = document.createElement('script');
    script.src = (apiX.runtime?.getURL ? apiX.runtime.getURL("content_script/interceptor/interceptor_page.js") : "");
    script.async = false;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.onload = () => { script.remove(); };
  } catch (e) {}

  // 2) Bridge page -> extension
  window.addEventListener("message", (event) => {
    if (event?.source !== window) return;
    const msg = event?.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.__owpt !== true || msg.type !== "owpt_intercept") return;

    try {
      apiX.runtime.sendMessage({ type: "interceptor_capture", payload: msg.payload }).catch(() => {});
    } catch(e) {}
  }, false);

  // 3) Notify page script that bridge is ready
  try {
    window.postMessage({ __owpt: true, type: "owpt_bridge_ready" }, "*");
  } catch (e) {}
})();

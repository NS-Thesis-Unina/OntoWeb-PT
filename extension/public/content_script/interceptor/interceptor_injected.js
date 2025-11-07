(function(){
  const apiX = typeof browser !== "undefined" ? browser : chrome;
  const FLAGS_KEY = "interceptor_flags";

  function injectFlagsScript(flagsObj) {
    try {
      const s = document.createElement('script');
      s.async = false;
      s.textContent = `try{window.__owptCaptureFlags=${JSON.stringify(flagsObj || {})};}catch(e){}`;
      (document.documentElement || document.head || document.body).appendChild(s);
      s.remove();
    } catch(e) {}
  }

  function injectPageScript() {
    try {
      const script = document.createElement('script');
      script.src = (apiX.runtime?.getURL ? apiX.runtime.getURL("content_script/interceptor/interceptor_page.js") : "");
      script.async = false;
      (document.documentElement || document.head || document.body).appendChild(script);
      script.onload = () => { script.remove(); };
    } catch (e) {}
  }

  function notifyFlagsApplied() {
    try {
      window.postMessage({ __owpt: true, type: "owpt_update_flags" }, "*");
    } catch {}
  }

  try {
    const get = apiX.storage?.local?.get ? apiX.storage.local.get(FLAGS_KEY) : Promise.resolve({});
    Promise.resolve(get).then((res) => {
      const flags = res?.[FLAGS_KEY] || {};
      injectFlagsScript(flags);
      injectPageScript();
      notifyFlagsApplied();
    }).catch(()=>{
      injectFlagsScript({});
      injectPageScript();
      notifyFlagsApplied();
    });
  } catch {
    injectFlagsScript({});
    injectPageScript();
    notifyFlagsApplied();
  }

  window.addEventListener("message", (event) => {
    if (event?.source !== window) return;
    const msg = event?.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.__owpt !== true || msg.type !== "owpt_intercept") return;
    try {
      apiX.runtime.sendMessage({ type: "interceptor_capture", payload: msg.payload }).catch(() => {});
    } catch(e) {}
  }, false);

  try {
    window.postMessage({ __owpt: true, type: "owpt_bridge_ready" }, "*");
  } catch (e) {}
})();

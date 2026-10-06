// Classic (non-module) script loaded in <head>: applies the saved theme before first paint.
(function () {
  try {
    var t = localStorage.getItem('planner-theme');
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) { /* ignore */ }
})();

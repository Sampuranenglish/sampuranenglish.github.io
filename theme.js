// Dark / light mode toggle for the Sampuran English site.
// Load this with <script src="theme.js"></script> near the end of
// <body> on EVERY page. Do NOT put this code inside header.html —
// header.html gets injected into each page via fetch()/innerHTML,
// and inline <script> tags added that way never execute in a browser.

(function () {
  var STORAGE_KEY = 'sampuran-theme';
  var root = document.documentElement;

  function getPreferredTheme() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    var prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Apply as soon as this script runs, so the page never flashes the
  // wrong theme — this doesn't depend on header.html having loaded yet.
  applyTheme(getPreferredTheme());

  // Listen on `document` and check what was clicked, instead of
  // attaching the listener straight to the button. This still works
  // even if header.html (and its button) gets added to the page
  // *after* this script has already run.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#themeToggle');
    if (!btn) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });
})();

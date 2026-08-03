/*
 * Applies the saved dark theme before the first paint, so a returning dark-mode
 * user never sees a flash of the light theme.
 *
 * This lives in its own file rather than inline in index.html for one reason:
 * a Content-Security-Policy with `script-src 'self'` blocks inline scripts
 * outright. Keeping it inline would have meant carrying a sha256 hash of this
 * exact source in every copy of the policy (helmet, the nginx blocks, the meta
 * tag) and regenerating all of them whenever a character changed here. An
 * external same-origin script needs none of that.
 *
 * It must stay a classic script tag WITHOUT defer/async/type=module: those all
 * postpone execution until after parsing, which reintroduces the flash. A
 * render-blocking same-origin script is the point.
 */
(function () {
  try {
    if (localStorage.getItem('laila-theme-preference') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    // localStorage throws in some privacy modes. A light-themed first paint is
    // a far better outcome than an uncaught error before the app boots.
  }
})();

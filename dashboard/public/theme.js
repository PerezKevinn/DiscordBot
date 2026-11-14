// Tema claro/oscuro del panel: se aplica antes de pintar para no parpadear.
// Sigue al sistema hasta que el usuario elige con el botón de la barra superior.
(function () {
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function stored() {
    try { return localStorage.getItem('massup-theme'); } catch (e) { return null; }
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0e14' : '#f5f7fa');
  }
  apply(stored() || (media && media.matches ? 'dark' : 'light'));
  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (!stored()) apply(media.matches ? 'dark' : 'light'); });
  }
})();

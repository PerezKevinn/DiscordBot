// Tema claro/oscuro: sigue al sistema hasta que el visitante elige con el botón del menú.
(function () {
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try { return localStorage.getItem('massup-theme'); } catch (e) { return null; }
  }
  function save(theme) {
    try { localStorage.setItem('massup-theme', theme); } catch (e) { /* sin almacenamiento: solo dura esta visita */ }
  }
  function system() {
    return media && media.matches ? 'dark' : 'light';
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0e14' : '#f5f7fa');
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      var next = theme === 'dark' ? 'claro' : 'oscuro';
      btn.setAttribute('aria-label', 'Cambiar a tema ' + next);
      btn.setAttribute('title', 'Cambiar a tema ' + next);
    }
  }

  apply(stored() || system());

  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (!stored()) apply(system()); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(root.getAttribute('data-theme'));
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var theme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      save(theme);
      apply(theme);
    });
  });
})();

// Runs before styles load to avoid showing the wrong theme on first paint.
(() => {
  const key = 'flynn-docs-theme';
  // Every appearance except light is dark underneath; the cyberpunk ones are chosen by hand and never follow the system.
  const names = {light:'Light', dark:'Dark', cyber:"Cyberpunk '80s", neo:'Cyberpunk modern'};
  const choices = [...Object.keys(names), 'system'];
  let preference = 'system';
  try { const saved = localStorage.getItem(key); if (choices.includes(saved)) preference = saved; } catch {}
  const lightQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  const root = document.documentElement;
  function apply() {
    const theme = preference === 'system' ? (lightQuery?.matches ? 'light' : 'dark') : preference;
    root.dataset.theme = theme;
    const control = document.getElementById('theme-choice');
    if (control) control.value = preference;
    const status = document.getElementById('theme-status');
    if (status) status.textContent = `${names[theme]} mode${preference === 'system' ? ', following your system preference' : ''}.`;
  }
  apply();
  lightQuery?.addEventListener?.('change', apply);
  window.addEventListener('storage', event => { if(event.key===key || event.key===null) { preference=choices.includes(event.newValue)?event.newValue:'system'; apply(); } });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-choice')?.addEventListener('change', event => {
      preference = event.target.value;
      try { localStorage.setItem(key,preference); } catch {}
      apply();
    });
  });
})();

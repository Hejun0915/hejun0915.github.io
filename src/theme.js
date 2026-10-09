/* Runs in the head before first paint; no server timezone or location lookup. */
(function (global) {
  'use strict';
  const THEMES = Object.freeze({
    morning: { label: 'Morning', hours: '05:00–10:59', color: '#945c37', description: 'Warm morning light falls from the left across the pixel-art island and village.' },
    noon: { label: 'Day', hours: '11:00–16:59', color: '#285638', description: 'Soft midday sunlight illuminates the pixel-art island, village, river, and mountains.' },
    dusk: { label: 'Dusk', hours: '17:00–19:59', color: '#406c69', description: 'Copper sunset light falls from the right over the island, with long cool evening shadows.' },
    night: { label: 'Night', hours: '20:00–04:59', color: '#b1a0d0', description: 'The pixel-art island at night, with warm light spilling from village windows onto the paths.' }
  });
  const GREETINGS = Object.freeze({
    morning: ['Good Morning!', 'Rise and Shine!', 'Hello, Sunshine!', 'Hello, New Day!'],
    noon: ['Good Afternoon!', 'Hello There!', 'Have a Good Day!', 'Hey, Explorer!'],
    dusk: ['Good Evening!', 'Hello, Sunset!', 'Hey, Golden Hour!', 'Evening, Friend!'],
    night: ['Hello, Night Owl!', 'Good Night!', 'Hey, Stargazer!', 'A Starry Hello!']
  });
  function randomGreeting(theme, previous = '', random = Math.random) {
    const choices = GREETINGS[theme].filter(greeting => greeting !== previous);
    return choices[Math.floor(random() * choices.length)];
  }
  function themeForHour(hour) {
    if (!Number.isFinite(hour) || hour < 0 || hour >= 24) throw new RangeError('Local hour must be between 0 and 24.');
    return hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'noon' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
  }
  function toggleManualTheme(current, clicked) {
    if (!Object.hasOwn(THEMES, clicked)) throw new RangeError('Unknown theme.');
    return current === clicked ? null : clicked;
  }
  const api = { THEMES, GREETINGS, themeForHour, toggleManualTheme, randomGreeting };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!global.document) return;
  global.HomepageTheme = api;
  const root = document.documentElement;
  const storageKey = 'jun-he:time-theme';
  let manual = null;
  try { const stored = sessionStorage.getItem(storageKey); if (Object.hasOwn(THEMES, stored)) manual = stored; } catch { /* Restricted storage still supports theme controls. */ }
  let ready = false;
  let greetingTheme = null;
  const greetings = {};
  function applyTheme() {
    const now = new Date();
    const active = manual || themeForHour(now.getHours());
    root.dataset.theme = active;
    root.dataset.themeMode = manual ? 'manual' : 'auto';
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content = THEMES[active].color;
    if (!ready) return;
    const clock = new Intl.DateTimeFormat('en-GB', {hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
    const status = document.querySelector('#theme-status');
    if(greetingTheme !== active){
      greetings[active] = randomGreeting(active, greetings[active]);
      greetingTheme = active;
    }
    const clockElement = document.querySelector('#theme-clock');
    clockElement.textContent = clock;
    clockElement.setAttribute('datetime', clock);
    document.querySelector('#theme-greeting').textContent = greetings[active];
    status.setAttribute('aria-label', `${greetings[active]} Local time ${clock}, ${zone}.`);
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const name = button.dataset.themeChoice;
      button.setAttribute('aria-pressed', String(manual === name));
      button.classList.toggle('is-current', active === name);
      button.classList.toggle('is-manual', manual === name);
      button.setAttribute('aria-label', manual === name ? `${THEMES[name].label} selected. Activate again to follow local time.` : `Preview ${THEMES[name].label.toLowerCase()} theme`);
    });
    const scene = document.querySelector('#world-scene');
    scene.setAttribute('aria-label', THEMES[active].description);
    document.querySelector('#world-time').textContent = `${THEMES[active].label.toUpperCase()} / ${clock}`;
  }
  applyTheme();
  function initialize() {
    ready = true;
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
      manual = toggleManualTheme(manual, button.dataset.themeChoice);
      try { if(manual) sessionStorage.setItem(storageKey, manual); else sessionStorage.removeItem(storageKey); } catch { /* State remains in memory. */ }
      applyTheme();
      document.querySelector('#theme-announcement').textContent = manual ? `${THEMES[manual].label} theme selected. Select it again to return to local time.` : 'Automatic theme restored. Following your local time.';
    }));
    applyTheme();
    // Re-evaluate local time after sleeping/background tabs and timezone changes.
    setInterval(applyTheme, 30000);
    addEventListener('focus', applyTheme);
    document.addEventListener('visibilitychange', () => { if(!document.hidden)applyTheme(); });
  }
  if(document.readyState === 'loading')document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})(typeof window !== 'undefined' ? window : globalThis);

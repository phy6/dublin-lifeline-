import { loadServices } from './services.js';
import init, { handleThemeChange } from './map.js';
import { init as initDirectory } from './directory.js';
import { init as initTimetable } from './timetable.js';
import { init as initGuide } from './guide.js';

const PAGES = {
  '#/map': 'homePage',
  '#/timetable': 'timetablePage',
  '#/guide': 'guidePage'
};

class DublinLifelineApp {
  constructor() {
    this.services = [];
  }

  async init() {
    document.documentElement.classList.remove('no-js');
    try {
      this.services = await loadServices();
    } catch (err) {
      console.error('Failed to load services:', err);
    }
    this.setupTheme();
    this.setupNavigation();
    await this.initModules();
    this.handleRoute();
    this.setupOfflineIndicator();
    this.registerServiceWorker();
  }

  async initModules() {
    try { await init(); } catch (err) { console.error('[App] Map init failed:', err); }
    try { initDirectory(); } catch (err) { console.error('[App] Directory init failed:', err); }
    try { initTimetable(); } catch (err) { console.error('[App] Timetable init failed:', err); }
    try { initGuide(); } catch (err) { console.error('[App] Guide init failed:', err); }
  }

  handleRoute() {
    const hash = window.location.hash || '#/map';
    Object.entries(PAGES).forEach(([route, pageId]) => {
      const el = document.getElementById(pageId);
      if (!el) return;
      if (hash === route) {
        el.classList.add('active');
        el.style.display = '';
      } else {
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });
  }

  setupTheme() {
    const btn = document.getElementById('themeBtn');
    const saved = localStorage.getItem('dublin-lifeline-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      if (btn) btn.textContent = saved === 'dark' ? '☀️ Light' : '☾ Dark';
    }
    if (btn) {
btn.addEventListener('click', () => {
         const current = document.documentElement.getAttribute('data-theme');
         const next = current === 'dark' ? 'light' : 'dark';
         document.documentElement.setAttribute('data-theme', next);
         localStorage.setItem('dublin-lifeline-theme', next);
         btn.textContent = next === 'dark' ? '☀️ Light' : '☾ Dark';
         handleThemeChange();
       });
    }
  }

  setupNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const pageId = tab.getAttribute('aria-controls');
        const route = Object.entries(PAGES).find(([_, id]) => id === pageId)?.[0] || '#/map';
        window.location.hash = route;
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        this.handleRoute();
      });
    });
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  setupOfflineIndicator() {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) return;
    const update = () => { indicator.style.display = navigator.onLine ? 'none' : 'block'; };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('SW registered:', reg.scope);
      }).catch(() => {});
    }
  }
}

const app = new DublinLifelineApp();
window.DublinLifelineApp = { init: () => app.init() };

if (sessionStorage.redirect) {
  const redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  if (redirect !== location.href) history.replaceState(null, '', redirect);
}

document.addEventListener('DOMContentLoaded', () => app.init());

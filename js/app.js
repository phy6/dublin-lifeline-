import { loadServices, getAllServices, searchServices, filterByCategory } from './services.js';
import { initMap } from './map.js';
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
    this.registerServiceWorker();
  }

  async initModules() {
    try { initMap(); } catch (_) {}
    try { initDirectory(); } catch (_) {}
    try { initTimetable(); } catch (_) {}
    try { initGuide(); } catch (_) {}
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
      });
    }
  }

  setupNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        this.handleRoute();
      });
    });
    window.addEventListener('hashchange', () => this.handleRoute());
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

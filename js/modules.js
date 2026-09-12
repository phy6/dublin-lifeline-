const DublinLifelineApp = (() => {
  let appData = { providers: [], categories: [], allTags: [] };
  let map, markersLayer;
  let currentFormat = 'day';

  const DUBLIN_CENTER = [53.3498, -6.2603];
  const DEFAULT_ZOOM = 13;

  function init() {
    document.body.classList.remove('no-js');
    initTheme();
    initMap();
    loadData();
    setupTabs();
    setupTheme();
    setupGuideAccordions();
    setupModal();
    populateServiceSelect();
    registerServiceWorker();
    setDefaultDate();
    setupMapFallback();
  }

  function initTheme() {
    const saved = localStorage.getItem('dublin-theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('themeBtn').textContent = '☀️ Light';
    }
  }

  function setupMapFallback() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    const timer = setTimeout(() => {
      if (!mapEl.querySelector('.leaflet-tile-pane') && !mapEl.querySelector('.leaflet-marker-pane')) {
        mapEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--warn);background:var(--panel);border-radius:14px;border:1px solid var(--line);"><p>🗺️ Map could not load. Check your internet connection.</p><p>Use the directory cards below for addresses and phone numbers.</p></div>';
      }
    }, 5000);
    if (typeof L !== 'undefined' && map) {
      clearTimeout(timer);
    }
  }

  function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    try {
      if (typeof L === 'undefined') throw new Error('Leaflet not loaded');
      map = L.map('map').setView(DUBLIN_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);
    } catch (err) {
      console.warn('[Dublin Lifeline] Map initialization failed:', err);
      mapEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--warn);background:var(--panel);border-radius:14px;border:1px solid var(--line);"><p>🗺️ Map unavailable. Use the directory cards below for contact details.</p></div>';
    }
  }

  async function loadData() {
    try {
      const res = await fetch('./data/services.json');
      const json = await res.json();
      appData.providers = json.services || json.results || [];
      buildIndex();
      renderAll();
    } catch (err) {
      console.warn('Could not load services.json, trying scraped_output.json', err);
      try {
        const res = await fetch('./data/scraped_output.json');
        const json = await res.json();
        appData.providers = json.results || [];
        buildIndex();
        renderAll();
      } catch (e) {
        document.getElementById('cards').innerHTML = '<div style="color:var(--danger);padding:2rem;text-align:center;">Failed to load services data. Run <code>npm run scrape && npm run merge</code>.</div>';
      }
    }
  }

  function buildIndex() {
    appData.categories = [...new Set(appData.providers.map(p => p.category).filter(Boolean))].sort();
    appData.allTags = [...new Set(appData.providers.flatMap(p => p.tags || []))].sort();
  }

  function renderAll() {
    renderCards(appData.providers);
    renderGuideContent();
    populateFilterChips();
    populateServiceSelect();
    document.getElementById('stat-count').textContent = appData.providers.length;
  }

  function renderCards(providers) {
    const container = document.getElementById('cards');
    container.innerHTML = '';
    markersLayer.clearLayers();

    if (providers.length === 0) {
      container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:2rem;">No matching services found.</div>';
      return;
    }

    providers.forEach(p => {
      if (p.latitude && p.longitude) {
        const icon = createCustomIcon(p);
        const marker = L.marker([p.latitude, p.longitude], { icon });
        marker.bindPopup(createPopupHTML(p));
        markersLayer.addLayer(marker);
      }

      const card = document.createElement('div');
      card.className = 'card';
      const tagsHtml = (p.tags || []).slice(0, 5).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      const servicesHtml = (p.services || []).length > 0 ? `<div style="font-size:.78rem;color:var(--accent);margin-top:6px;flex-wrap:wrap;display:flex;gap:4px;">${(p.services || []).slice(0, 6).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>` : '';
      const hoursHtml = (p.hours && Object.keys(p.hours).length > 0) ? `<div class="hours">${formatHours(p.hours)}</div>` : '';
      const dynamicHtml = (p.dynamicActivities || []).length > 0 ? `<div style="font-size:.72rem;color:var(--muted);margin-top:4px;">Auto-discovered: ${(p.dynamicActivities || []).slice(0, 5).join(', ')}</div>` : '';

      card.innerHTML = `
        <h3>${escapeHtml(p.name)}</h3>
        <div class="kind">${escapeHtml(p.category || 'General')}</div>
        ${p.address ? `<div style="font-size:.85rem;color:var(--muted);margin-top:4px;">📍 ${escapeHtml(p.address)}</div>` : ''}
        ${p.email ? `<div style="font-size:.82rem;color:var(--muted);">✉️ ${escapeHtml(p.email)}</div>` : ''}
        ${hoursHtml}
        ${p.description ? `<div class="note">${escapeHtml(p.description)}</div>` : ''}
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${tagsHtml}</div>
        ${servicesHtml}
        ${dynamicHtml}
        <div style="font-size:.72rem;color:var(--muted);margin-top:6px;">📅 Last verified: ${p.lastScraped ? new Date(p.lastScraped).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'numeric'}) : 'N/A'}</div>
        <div class="actions">
          ${p.phone ? `<a href="tel:${escapeHtml(p.phone)}" class="primary">📞 Call</a>` : ''}
          ${p.website && p.website.startsWith('http') ? `<a href="${escapeHtml(p.website)}" target="_blank" rel="noopener">🌐 Website</a>` : ''}
          ${(p.latitude && p.longitude) ? `<button onclick="DublinLifelineApp.centerOnMap(${p.latitude},${p.longitude})">🗺️ Map</button>` : ''}
          <a href="mailto:report@localhost?subject=Incorrect%20info%20for%20${encodeURIComponent(p.name)}&body=Please%20review%20and%20correct%20the%20following%20listing:%20${encodeURIComponent(p.name)}%20-%20${encodeURIComponent(p.address||'')}" style="color:var(--warn);font-weight:850;font-size:.75rem;text-decoration:underline;border:2px solid var(--warn);border-radius:9px;padding:6px 4px;text-align:center;">⚠ Report incorrect info</a>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function createCustomIcon(provider) {
    const emoji = (provider.tags || []).includes('meal') ? '🍲' :
                  (provider.tags || []).includes('shelter') ? '🏠' :
                  (provider.tags || []).includes('medical') ? '🩺' :
                  (provider.tags || []).includes('education') ? '📚' : '📍';
    return L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="font-size:18px;line-height:28px;">${emoji}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function createPopupHTML(p) {
    const tagsHtml = (p.tags || []).slice(0, 4).map(t => `<span style="font-size:.7rem;background:var(--chip);color:var(--text);padding:2px 6px;border-radius:4px;">${escapeHtml(t)}</span>`).join('');
    return `
      <div style="font-size:0.9rem;min-width:200px;">
        <strong style="color:var(--accent);font-size:1.05rem;">${escapeHtml(p.name)}</strong><br/>
        <span style="font-size:.78rem;color:var(--muted);">${escapeHtml(p.category || 'General')}</span><br/>
        ${p.address ? `<span style="font-size:.85rem;">📍 ${escapeHtml(p.address)}</span><br/>` : ''}
        ${p.phone ? `<a href="tel:${escapeHtml(p.phone)}" style="color:var(--accent);font-size:.85rem;">📞 ${escapeHtml(p.phone)}</a><br/>` : ''}
        ${p.website && p.website.startsWith('http') ? `<a href="${escapeHtml(p.website)}" target="_blank" style="color:var(--accent);font-size:.85rem;">🌐 Website</a><br/>` : ''}
        ${(p.hours && Object.keys(p.hours).length > 0) ? `<div style="margin-top:4px;font-size:.8rem;color:var(--muted);">${formatHours(p.hours)}</div>` : ''}
        <div style="margin-top:4px;">${tagsHtml}</div>
        ${(p.services || []).length > 0 ? `<div style="margin-top:4px;font-size:.75rem;color:var(--accent);">Services: ${(p.services || []).join(', ')}</div>` : ''}
      </div>
    `;
  }

  function formatHours(hours) {
    const dayMap = {'mon':'Mon','tue':'Tue','wed':'Wed','thu':'Thu','fri':'Fri','sat':'Sat','sun':'Sun','mon-fri':'Mon–Fri','mon-sun':'Mon–Sun','default':'All days'};
    const parts = Object.entries(hours).map(([d, h]) => `${dayMap[d] || d}: ${h}`);
    return parts.join(' · ');
  }

  function populateFilterChips() {
    const container = document.getElementById('filterChips');
    const currentVal = container.querySelector('.chip.active');
    const activeFilter = currentVal ? currentVal.textContent.trim().toLowerCase() : 'all';
    container.innerHTML = `
      <button class="chip ${activeFilter === 'all' ? 'active' : ''}" onclick="filterServices('all', this)">All Services</button>
      <button class="chip ${activeFilter === 'food' ? 'active' : ''}" onclick="filterServices('food', this)">🍲 Food</button>
      <button class="chip ${activeFilter === 'shelter' ? 'active' : ''}" onclick="filterServices('shelter', this)">🏠 Shelter</button>
      <button class="chip ${activeFilter === 'medical' ? 'active' : ''}" onclick="filterServices('medical', this)">🩺 Medical</button>
      <button class="chip ${activeFilter === 'counselling' ? 'active' : ''}" onclick="filterServices('counselling', this)">💬 Support</button>
      <button class="chip ${activeFilter === 'community' ? 'active' : ''}" onclick="filterServices('community', this)">🤝 Community</button>
      <button class="chip ${activeFilter === 'education' ? 'active' : ''}" onclick="filterServices('education', this)">📚 Education</button>
    `;
  }

  function filterServices(filter, btn) {
    const chips = document.querySelectorAll('#filterChips .chip');
    chips.forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');

    let filtered = appData.providers;
    if (filter !== 'all') {
      filtered = appData.providers.filter(p => (p.tags || []).includes(filter) || (p.services || []).includes(filter) || (p.category || '').toLowerCase().includes(filter));
    }
    renderCards(filtered);
    document.getElementById('stat-count').textContent = filtered.length;
  }

  function setupTabs() {
    window.showPage = function(pageId, btn) {
      document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.getElementById(pageId).classList.add('active');
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      }
      if (pageId === 'homePage' && map) map.invalidateSize();
    };
  }

  function setupTheme() {
    const btn = document.getElementById('themeBtn');
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('themeBtn').textContent = '☾ Dark';
        localStorage.setItem('dublin-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeBtn').textContent = '☀️ Light';
        localStorage.setItem('dublin-theme', 'dark');
      }
      if (map) map.invalidateSize();
    });
  }

  function requestGPS() {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 15);
      L.marker([latitude, longitude]).addTo(markersLayer).bindPopup('📍 Your Location');
      document.getElementById('locationText').textContent = `📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }, () => alert('Could not get your location'));
  }

  function centerOnMap(lat, lng) {
    map.setView([lat, lng], 16);
    markersLayer.eachLayer(layer => {
      if (layer.getLatLng().lat === lat && layer.getLatLng().lng === lng) layer.openPopup();
    });
    if (window.innerWidth < 768) document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
  }

  function renderGuideContent() {
    const meals = appData.providers.filter(p => (p.tags || []).includes('food') || (p.services || []).includes('food'));
    const clothing = appData.providers.filter(p => (p.tags || []).includes('clothing') || (p.tags || []).includes('homeless'));
    const housing = appData.providers.filter(p => (p.tags || []).includes('shelter') || (p.tags || []).includes('housing'));
    const health = appData.providers.filter(p => (p.tags || []).includes('medical') || (p.tags || []).includes('counselling'));
    const education = appData.providers.filter(p => (p.tags || []).includes('education') || (p.tags || []).includes('library'));

    document.getElementById('guideMealsContent').innerHTML = meals.length > 0
      ? `<ul>${meals.map(p => `<li><strong>${escapeHtml(p.name)}</strong>: ${escapeHtml(p.address)} — ${escapeHtml(p.phone)}<br>Services: ${(p.services || []).join(', ')}<br>Hours: ${formatHours(p.hours || {})}</li>`).join('')}</ul>`
      : '<p>No meal providers found.</p>';

    document.getElementById('guideClothingContent').innerHTML = clothing.length > 0
      ? `<ul>${clothing.map(p => `<li><strong>${escapeHtml(p.name)}</strong>: ${escapeHtml(p.address)} — ${escapeHtml(p.phone)}<br>Tags: ${(p.tags || []).join(', ')}</li>`).join('')}</ul>`
      : '<p>No clothing providers found.</p>';

    document.getElementById('guideHousingContent').innerHTML = housing.length > 0
      ? `<ul>${housing.map(p => `<li><strong>${escapeHtml(p.name)}</strong>: ${escapeHtml(p.address)} — ${escapeHtml(p.phone)}<br>Hours: ${formatHours(p.hours || {})}</li>`).join('')}</ul>`
      : '<p>No housing providers found.</p>';

    document.getElementById('guideHealthContent').innerHTML = health.length > 0
      ? `<ul>${health.map(p => `<li><strong>${escapeHtml(p.name)}</strong>: ${escapeHtml(p.address)} — ${escapeHtml(p.phone)}<br>Services: ${(p.services || []).join(', ')}<br>Hours: ${formatHours(p.hours || {})}</li>`).join('')}</ul>`
      : '<p>No health providers found.</p>';

    document.getElementById('guideEducationContent').innerHTML = education.length > 0
      ? `<ul>${education.map(p => `<li><strong>${escapeHtml(p.name)}</strong>: ${escapeHtml(p.address)} — ${escapeHtml(p.phone)}<br>Services: ${(p.services || []).join(', ')}</li>`).join('')}</ul>`
      : '<p>No education providers found.</p>';

    document.getElementById('guidePathwaysContent').innerHTML = `
      <ul>
        <li><strong>Emergency Night Beds (DRHE):</strong> Call <strong>1800 707 707</strong> daily at 10:00 AM to register.</li>
        <li><strong>Supplementary Welfare Allowance (SWA):</strong> Contact your local Intreo Centre or Community Welfare Officer (CWO).</li>
        <li><strong>Urgent Needs Payment:</strong> One-off emergency payments for essential food, clothing, or deposits.</li>
        <li><strong>Capuchin Day Centre:</strong> Free clothing, hygiene packs, medical & dental clinic.</li>
        <li><strong>Merchants Quay Ireland:</strong> Warm showers, toiletries, emergency clothing.</li>
      </ul>
    `;
  }

  function setupGuideAccordions() {
    document.querySelectorAll('details.guide-acc').forEach(acc => {
      acc.addEventListener('toggle', () => {
        if (acc.open) {
          const summary = acc.querySelector('summary');
          summary.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  function populateServiceSelect() {
    const select = document.getElementById('evtService');
    select.innerHTML = '<option value="">-- Choose Service --</option>';
    appData.providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = `${p.name} | ${p.address}`;
      opt.textContent = `${escapeHtml(p.name)} — ${escapeHtml(p.address)}`;
      select.appendChild(opt);
    });
  }

  function autoFillTime(val) {
    if (!val) return;
    const now = new Date();
    const tStr = now.toTimeString().substring(0, 5);
    document.getElementById('evtTime').value = tStr;
  }

  function setDefaultDate() {
    const input = document.getElementById('evtDate');
    if (input && !input.value) {
      input.value = new Date().toISOString().split('T')[0];
    }
  }

  function setupModal() {
    const overlay = document.getElementById('addModal');
    if (!overlay) return;
    const closeBtn = overlay.querySelector('.modal-close');
    let triggerElement = null;

    function getFocusableElements() {
      return overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    }

    function trapFocus(e) {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }

    window.openAddModal = function() {
      triggerElement = document.activeElement;
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        const first = getFocusableElements()[0];
        if (first) first.focus();
      }, 50);
      overlay.addEventListener('keydown', trapFocus);
    };

    window.closeAddModal = function() {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeEventListener('keydown', trapFocus);
      if (triggerElement) { triggerElement.focus(); triggerElement = null; }
    };

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeAddModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeAddModal();
      }
    });
  }

  function saveEvent() {
    const date = document.getElementById('evtDate').value;
    const service = document.getElementById('evtService').value;
    const time = document.getElementById('evtTime').value;
    if (!date || !service) { alert('Please select a date and service.'); return; }
    alert(`Event saved: ${service} on ${date} at ${time}`);
    closeAddModal();
  }
  window.saveEvent = saveEvent;

  function toggleGridFormat(fmt) {
    currentFormat = fmt;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(fmt + 'Btn').classList.add('active');
    renderTimetableGrid();
  }
  window.toggleGridFormat = toggleGridFormat;

  function renderTimetableGrid() {
    const container = document.getElementById('gridContainer');
    if (currentFormat === 'day') renderDayGrid(container);
    else if (currentFormat === 'week') renderWeekGrid(container);
    else renderMonthGrid(container);
  }

  function renderDayGrid(container) {
    const today = new Date().toLocaleDateString('en-IE', {weekday:'long'}).substring(0,3).toLowerCase();
    container.innerHTML = `<div class="day-focus-card"><h3>Today's Schedule</h3><div id="dayEvents"></div></div>`;
    const events = appData.providers.map(p => `<div class="day-event-item"><strong>${escapeHtml(p.name)}</strong><span>${formatHours(p.hours || {})}</span></div>`).join('');
    const el = document.getElementById('dayEvents');
    if (el) el.innerHTML = events || '<div style="color:var(--muted)">No events today.</div>';
  }

  function renderWeekGrid(container) {
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    container.innerHTML = '<div class="week-grid">' + days.map(d => {
      const dayProviders = appData.providers.slice(0, 2);
      return `<div class="day-box"><h4>${d.substring(0,3).toUpperCase()}</h4>${dayProviders.map(p => `<div class="grid-event">${escapeHtml(p.name)}</div>`).join('')}</div>`;
    }).join('') + '</div>';
  }

  function renderMonthGrid(container) {
    const weeks = 5;
    container.innerHTML = '<div class="month-grid">' + Array(weeks).fill('<div class="month-box"></div>').join('') + '</div>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('[Dublin Lifeline] SW registered:', reg.scope);
      }).catch(err => {
        console.warn('[Dublin Lifeline] SW registration failed:', err);
      });
    }
  }

  return { init, centerOnMap, filterServices };
})();

document.addEventListener('DOMContentLoaded', () => DublinLifelineApp.init());
window.DublinLifelineApp = DublinLifelineApp;
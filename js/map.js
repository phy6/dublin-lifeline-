import { escapeHtml } from './services.js';

let map = null;
let markersLayer = null;
let markerMap = new Map();

function getEmoji(provider) {
  const tags = (provider.tags || []).map(t => t.toLowerCase());
  const services = (provider.services || []).map(s => s.toLowerCase());
  if (tags.includes('food') || services.includes('food')) return '🍲';
  if (tags.includes('shelter') || tags.includes('housing') || tags.includes('homelessness')) return '🏠';
  if (tags.includes('medical') || tags.includes('counselling')) return '🩺';
  if (tags.includes('education') || tags.includes('library')) return '📚';
  return '📍';
}

export function initMap() {
  if (typeof L === 'undefined') return;
  map = L.map('map').setView([53.3498, -6.2603], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  setupMapFallback();
  return map;
}

export function addMarkers(providers) {
  if (!markersLayer || !Array.isArray(providers)) return;
  markersLayer.clearLayers();
  markerMap.clear();
  providers.forEach(provider => {
    const emoji = getEmoji(provider);
    const icon = L.divIcon({
      className: 'custom-marker',
      html: emoji,
      iconSize: [25, 25],
      iconAnchor: [12, 12]
    });
    const popupContent = `<strong>${escapeHtml(provider.name)}</strong><br>${escapeHtml(provider.address)}<br>${escapeHtml(provider.phone)}<br><a href="${escapeHtml(provider.website)}" target="_blank">${escapeHtml(provider.website)}</a>`;
    const marker = L.marker([provider.latitude, provider.longitude], { icon })
      .bindPopup(popupContent)
      .addTo(markersLayer);
    markerMap.set(`${provider.latitude},${provider.longitude}`, { marker, provider });
  });
}

export function centerOnMap(lat, lng) {
  if (!map) return;
  map.setView([lat, lng], 13);
  const key = `${lat},${lng}`;
  const found = markerMap.get(key);
  if (found && found.marker) {
    found.marker.openPopup();
  }
}

export function setupMapFallback() {
  setTimeout(() => {
    const mapEl = document.getElementById('map');
    if (mapEl && !mapEl.querySelector('.map-fallback') && map && !map._tilesLoaded) {
      const fallback = document.createElement('div');
      fallback.className = 'map-fallback';
      fallback.textContent = 'Map tiles failed to load. Please check your connection.';
      fallback.style.cssText = 'padding:20px;text-align:center;color:var(--muted);background:var(--panel);border-radius:8px;margin:10px;';
      mapEl.appendChild(fallback);
    }
  }, 5000);
}

export function handleThemeChange() {
  if (map) {
    map.invalidateSize();
  }
}

export async function init() {
  initMap();
  try {
    const { loadServices } = await import('./services.js');
    const providers = await loadServices();
    addMarkers(providers);
  } catch (err) {
    console.error('Failed to load services for map markers:', err);
  }
  return map;
}

export default init;

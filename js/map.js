export function initMap() {
  if (typeof L === 'undefined') return;
  const map = L.map('map').setView([53.3498, -6.2603], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  const markersLayer = L.layerGroup().addTo(map);
  return { map, markersLayer };
}

const SERVICE_DATA_URL = './data/services.json';

let cachedServices = null;

async function _loadFromFS() {
  const { readFileSync } = await import('node:fs');
  const raw = readFileSync(new URL('../data/services.json', import.meta.url), 'utf-8');
  const data = JSON.parse(raw);
  return data.services || data;
}

export async function loadServices() {
  try {
    const response = await fetch(SERVICE_DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    cachedServices = data.services || data;
    return cachedServices;
  } catch (_) {
    try {
      cachedServices = await _loadFromFS();
      return cachedServices;
    } catch (fsError) {
      if (cachedServices) return cachedServices;
      throw new Error('Failed to load services');
    }
  }
}

export function getAllServices() {
  return cachedServices || [];
}

export function searchServices(query) {
  if (!query || !cachedServices) return cachedServices || [];
  const q = query.toLowerCase().trim();
  return cachedServices.filter(provider =>
    provider.name.toLowerCase().includes(q) ||
    provider.description.toLowerCase().includes(q) ||
    provider.address.toLowerCase().includes(q) ||
    provider.services.some(s => s.toLowerCase().includes(q)) ||
    provider.tags.some(t => t.toLowerCase().includes(q))
  );
}

export function filterByCategory(providers, category) {
  if (!providers || !category) return providers || [];
  const cat = category.toLowerCase();
  return providers.filter(provider =>
    provider.category.toLowerCase() === cat ||
    provider.tags.some(t => t.toLowerCase() === cat)
  );
}

export function formatHours(hours) {
  if (!hours) return 'Hours not available';
  if (hours['closed'] || hours === 'closed') return 'Closed';
  const days = Object.keys(hours);
  if (days.length === 0) return 'Hours not available';
  if (days.length === 1 && days[0] === 'default') {
    const val = hours['default'];
    return val === 'closed' ? 'Closed' : formatDayRange(val);
  }
  const parts = days.map(day => {
    const val = hours[day];
    if (val === 'closed') return `${formatDay(day)}: Closed`;
    return `${formatDay(day)}: ${formatDayRange(val)}`;
  });
  return parts.join(' · ');
}

function formatDay(day) {
  const map = {
    'mon-fri': 'Mon-Fri', 'monday-friday': 'Mon-Fri',
    'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri',
    'sat': 'Sat', 'sun': 'Sun',
    'mon-sun': 'Mon-Sun', 'everyday': 'Everyday', 'daily': 'Daily'
  };
  return map[day.toLowerCase()] || day;
}

function formatDayRange(range) {
  return range;
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

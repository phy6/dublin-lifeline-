export function init() {
  const container = document.getElementById('directory-container');
  if (!container) return;
  container.innerHTML = '<p>Directory loading...</p>';
}

export function renderCards(providers) {
  const container = document.getElementById('directory-container');
  if (!container) return;
  container.innerHTML = providers.map(p =>
    `<div class="card"><h3>${p.name}</h3><p>${p.address}</p></div>`
  ).join('');
}

export function filterServices(filter) { return []; }
export function searchServices(query) { return []; }

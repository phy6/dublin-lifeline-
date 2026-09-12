export function init() {
  const container = document.getElementById('timetable-container');
  if (!container) return;
  container.innerHTML = '<p>Timetable loading...</p>';
}

export function renderGrid(format) { return ''; }
export function openModal() {}
export function closeModal() {}
export function saveEvent() {}

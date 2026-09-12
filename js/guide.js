export function init() {
  const container = document.getElementById('guide-container');
  if (!container) return;
  container.innerHTML = '<p>Guide loading...</p>';
}

export function renderGuideContent() { return ''; }

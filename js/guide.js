import { getAllServices, formatHours, escapeHtml } from './services.js';

const GUIDE_SECTIONS = {
  meals: {
    id: 'guideMealsContent',
    heading: '🍲 Free Meals & Grocery Food Parcels',
    filter: p => (p.tags || []).includes('food') || (p.services || []).includes('food')
  },
  clothing: {
    id: 'guideClothingContent',
    heading: '👕 Clothing, Hygiene & Essential Supplies',
    filter: p => (p.tags || []).includes('clothing') || (p.tags || []).includes('homeless')
  },
  housing: {
    id: 'guideHousingContent',
    heading: '🏠 Housing & Emergency Accommodation',
    filter: p => (p.tags || []).includes('shelter') || (p.tags || []).includes('housing')
  },
  health: {
    id: 'guideHealthContent',
    heading: '🩺 Mental Health & Crisis Support',
    filter: p => (p.tags || []).includes('medical') || (p.tags || []).includes('counselling')
  },
  education: {
    id: 'guideEducationContent',
    heading: '📚 Libraries & Free Workspaces',
    filter: p => (p.tags || []).includes('education') || (p.tags || []).includes('library') || (p.services || []).includes('education') || (p.services || []).includes('employment') || (p.services || []).includes('training')
  }
};

const PATHWAYS_DATA = [
  {
    title: 'Emergency Night Beds (DRHE)',
    detail: 'Call <strong>1800 707 707</strong> daily at 10:00 AM'
  },
  {
    title: 'Supplementary Welfare Allowance (SWA)',
    detail: 'Contact local Intreo Centre'
  },
  {
    title: 'Urgent Needs Payment',
    detail: 'One-off emergency payments'
  },
  {
    title: 'Capuchin Day Centre',
    detail: 'Free clothing, hygiene packs, medical & dental clinic'
  },
  {
    title: 'Merchants Quay Ireland',
    detail: 'Warm showers, toiletries, emergency clothing'
  }
];

function renderProviderLi(provider) {
  const name = escapeHtml(provider.name);
  const address = escapeHtml(provider.address || '');
  const phone = escapeHtml(provider.phone || '');
  const hoursStr = formatHours(provider.hours);
  const services = (provider.services || []).map(s => escapeHtml(s));
  const phoneLink = provider.phone ? ` <a href="tel:${phone}">📞 ${phone}</a>` : '';
  const servicesHtml = services.length > 0
    ? `<div class="guide-services">${services.map(s => `<span>${s}</span>`).join('')}</div>`
    : '';
  return `<li><strong>${name}</strong>${phoneLink}<div class="guide-hours">${hoursStr}</div>${servicesHtml}</li>`;
}

function renderSectionContent(sectionKey) {
  const section = GUIDE_SECTIONS[sectionKey];
  if (!section) return '';
  const providers = getAllServices().filter(section.filter);
  if (providers.length === 0) {
    return '<p style="padding:12px 16px;color:var(--muted)">No providers found in this category.</p>';
  }
  return `<ul>${providers.map(renderProviderLi).join('')}</ul>`;
}

export function init() {
  const container = document.getElementById('guide-container');
  if (!container) return;

  const accordions = container.querySelectorAll('details.guide-acc');
  accordions.forEach(acc => {
    acc.addEventListener('toggle', () => {
      const contentId = acc.querySelector('div[id$="Content"]');
      if (contentId && !contentId.innerHTML.trim()) {
        const sectionKey = Object.keys(GUIDE_SECTIONS).find(
          k => GUIDE_SECTIONS[k].id === contentId.id
        );
        if (sectionKey) {
          contentId.innerHTML = renderSectionContent(sectionKey);
        }
      }
    });
  });

  loadServicesAndRender();
}

async function loadServicesAndRender() {
  try {
    const { loadServices } = await import('./services.js');
    await loadServices();
    renderGuideContent();
  } catch (err) {
    console.error('Failed to load services for guide:', err);
  }
}

export function renderGuideContent() {
  const container = document.getElementById('guide-container');
  if (!container) return;

  Object.entries(GUIDE_SECTIONS).forEach(([key, section]) => {
    const contentEl = document.getElementById(section.id);
    if (contentEl) {
      contentEl.innerHTML = renderSectionContent(key);
    }
  });

  const pathwaysEl = document.getElementById('guidePathwaysContent');
  if (pathwaysEl) {
    pathwaysEl.innerHTML = PATHWAYS_DATA.map(item =>
      `<div class="guide-pathways-item"><strong>${escapeHtml(item.title)}</strong><div class="guide-pathways-detail">${item.detail}</div></div>`
    ).join('');
  }
}

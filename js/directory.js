import { getAllServices, filterByCategory, formatHours, escapeHtml } from './services.js';
import { markersLayer } from './map.js';
import { centerOnMap } from './map.js';

let currentFilter = 'all';
let currentProviders = [];

const FILTER_CATEGORIES = ['All', 'Food', 'Shelter', 'Medical', 'Support', 'Community', 'Education'];

export function init() {
    populateFilterChips();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchServices(e.target.value);
        });
    }
    currentProviders = getAllServices();
    renderCards(currentProviders);
}

export function renderCards(providers) {
    const cardsContainer = document.getElementById('cards');
    if (!cardsContainer) return;
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    cardsContainer.innerHTML = '';

    if (markersLayer) {
        markersLayer.clearLayers();
    }

    providers.forEach(provider => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-id', provider.id);

        const nameEl = document.createElement('h3');
        nameEl.textContent = provider.name;
        card.appendChild(nameEl);

        const kindEl = document.createElement('p');
        kindEl.className = 'kind';
        kindEl.textContent = provider.category || '';
        card.appendChild(kindEl);

        if (provider.address) {
            const addrEl = document.createElement('p');
            addrEl.textContent = provider.address;
            card.appendChild(addrEl);
        }

        if (provider.email) {
            const emailEl = document.createElement('p');
            emailEl.innerHTML = `<a href="mailto:${escapeHtml(provider.email)}">${escapeHtml(provider.email)}</a>`;
            card.appendChild(emailEl);
        }

        if (provider.hours) {
            const hoursStr = formatHours(provider.hours);
            if (hoursStr && hoursStr !== 'Hours not available') {
                const hoursEl = document.createElement('p');
                hoursEl.textContent = hoursStr;
                card.appendChild(hoursEl);
            }
        }

        if (provider.description) {
            const descEl = document.createElement('p');
            descEl.textContent = provider.description;
            card.appendChild(descEl);
        }

        const tagsDiv = document.createElement('div');
        const tags = (provider.tags || []).slice(0, 5);
        tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag;
            tagsDiv.appendChild(span);
        });
        card.appendChild(tagsDiv);

        const servicesDiv = document.createElement('div');
        const services = (provider.services || []).slice(0, 6);
        services.forEach(svc => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = svc;
            servicesDiv.appendChild(span);
        });
        card.appendChild(servicesDiv);

        const verifiedEl = document.createElement('p');
        verifiedEl.textContent = `Last verified: ${provider.lastVerified || 'N/A'}`;
        card.appendChild(verifiedEl);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'card-actions';

        if (provider.phone) {
            const callBtn = document.createElement('a');
            callBtn.href = `tel:${provider.phone}`;
            callBtn.textContent = 'Call';
            callBtn.setAttribute('aria-label', `Call ${provider.name}`);
            actionsDiv.appendChild(callBtn);
        }

        if (provider.website) {
            const webBtn = document.createElement('a');
            webBtn.href = provider.website;
            webBtn.target = '_blank';
            webBtn.rel = 'noopener noreferrer';
            webBtn.textContent = 'Website';
            webBtn.setAttribute('aria-label', `Visit website for ${provider.name}`);
            actionsDiv.appendChild(webBtn);
        }

        const mapBtn = document.createElement('button');
        mapBtn.textContent = 'Map';
        mapBtn.setAttribute('aria-label', `Show ${provider.name} on map`);
        mapBtn.addEventListener('click', () => {
            if (typeof centerOnMap === 'function') {
                centerOnMap(provider.latitude, provider.longitude);
            }
        });
        actionsDiv.appendChild(mapBtn);

        const reportBtn = document.createElement('a');
        const subject = `Incorrect information for ${provider.name}`;
        const body = `Provider: ${provider.name}\nAddress: ${provider.address}\nPlease specify the incorrect information.`;
        reportBtn.href = `mailto:help@dublinlifeline.ie?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        reportBtn.textContent = 'Report incorrect info';
        reportBtn.setAttribute('aria-label', `Report incorrect information for ${provider.name}`);
        actionsDiv.appendChild(reportBtn);

        card.appendChild(actionsDiv);
        cardsContainer.appendChild(card);
    });

    updateStats(providers.length, getAllServices().length);
}

export function filterServices(filter) {
    currentFilter = filter;
    const all = getAllServices();
    let filtered;
    if (filter === 'all') {
        filtered = all;
    } else {
        filtered = filterByCategory(all, filter.toLowerCase());
    }
    renderCards(filtered);
}

export function searchServices(query) {
    const all = getAllServices();
    let filtered;
    if (!query || !query.trim()) {
        filtered = currentFilter === 'all' ? all : filterByCategory(all, currentFilter.toLowerCase());
    } else {
        const q = query.toLowerCase().trim();
        filtered = all.filter(provider =>
            provider.name.toLowerCase().includes(q) ||
            provider.address.toLowerCase().includes(q) ||
            provider.description.toLowerCase().includes(q) ||
            provider.services.some(s => s.toLowerCase().includes(q)) ||
            provider.tags.some(t => t.toLowerCase().includes(q))
        );
    }
    renderCards(filtered);
}

export function populateFilterChips() {
    const container = document.getElementById('filterChips');
    if (!container) return;
    container.innerHTML = '';

    FILTER_CATEGORIES.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'filter-chip';
        btn.textContent = category;
        btn.setAttribute('data-filter', category.toLowerCase());
        btn.setAttribute('aria-label', `Filter by ${category}`);
        if (category === 'All') {
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterServices(category.toLowerCase());
        });
        container.appendChild(btn);
    });
}

export function updateStats(filtered, total) {
    const statsBar = document.getElementById('stats-bar');
    if (!statsBar) return;
    statsBar.textContent = `Showing ${filtered} of ${total} providers`;
}

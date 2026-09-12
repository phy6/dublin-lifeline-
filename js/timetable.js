import { getAllServices, formatHours } from './services.js';

let currentFormat = 'day';
let triggerElement = null;
let _keydownHandler = null;
let _focusTrapHandler = null;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getServicesForDay(dayKey) {
  const all = getAllServices();
  const dayProviders = [];
  all.forEach(p => {
    if (p.hours && p.hours[dayKey] && p.hours[dayKey] !== 'closed') {
      dayProviders.push(p);
    }
  });
  return dayProviders;
}

function getDayName(dayIndex) {
  const date = new Date();
  date.setDate(date.getDate() + dayIndex);
  return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

function getDayLabel(dayIndex) {
  return DAY_LABELS[dayIndex];
}

function getDayKey(dayIndex) {
  return DAY_KEYS[dayIndex];
}

export function init() {
  const container = document.getElementById('timetable-container');
  if (!container) return;

  container.innerHTML = `
    <div class="timetable-toolbar">
      <button class="format-btn active" data-format="day">Day</button>
      <button class="format-btn" data-format="week">Week</button>
      <button class="format-btn" data-format="month">Month</button>
      <button id="addScheduleBtn">+ Add Schedule</button>
    </div>
    <div id="timetableGrid"></div>
  `;

  container.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleGridFormat(btn.dataset.format));
  });

  const addBtn = document.getElementById('addScheduleBtn');
  if (addBtn) {
    addBtn.addEventListener('click', openModal);
  }

  const modal = document.getElementById('addModal');
  if (modal) {
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
    const form = document.getElementById('scheduleForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEvent();
      });
    }
  }

  renderGrid('day');
}

export function renderGrid(format) {
  currentFormat = format;
  const grid = document.getElementById('timetableGrid');
  if (!grid) return;

  if (format === 'day') {
    renderDayGrid(grid);
  } else if (format === 'week') {
    renderWeekGrid(grid);
  } else if (format === 'month') {
    renderMonthGrid(grid);
  }

  const container = document.getElementById('timetable-container');
  if (container) {
    container.querySelectorAll('.format-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.format === format);
    });
  }
}

function renderDayGrid(grid) {
  const all = getAllServices();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayKey = DAY_KEYS[today.getDay() === 0 ? 6 : today.getDay() - 1];
  const hours = formatHours(all[0]?.hours) || '';

  const todayProviders = all.filter(p => p.hours && p.hours[dayKey] && p.hours[dayKey] !== 'closed');

  let html = `<div class="day-focus-card"><h3>${dayName}</h3>`;
  if (todayProviders.length === 0) {
    html += '<p style="color:var(--muted)">No providers open today</p>';
  }
  todayProviders.forEach(p => {
    const hrs = p.hours[dayKey];
    html += `<div class="provider-hour"><strong>${escapeHtml(p.name)}</strong> — ${hrs}</div>`;
  });
  html += '</div>';
  grid.innerHTML = html;
}

function renderWeekGrid(grid) {
  let html = '<div class="week-grid">';
  for (let i = 0; i < 7; i++) {
    const providers = getServicesForDay(DAY_KEYS[i]);
    const label = getDayLabel(i);
    html += `<div class="day-box"><div class="day-name">${label}</div>`;
    const showProviders = providers.slice(0, 3);
    showProviders.forEach(p => {
      html += `<div class="provider-item"><strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.hours[DAY_KEYS[i]] || '')}</div>`;
    });
    if (providers.length > 3) {
      html += `<div class="provider-item" style="color:var(--muted)">+${providers.length - 3} more</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  grid.innerHTML = html;
}

function renderMonthGrid(grid) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '<div class="month-grid">';
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

  for (let i = 0; i < startOffset; i++) {
    html += '<div class="cell empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth();
    const date = new Date(year, month, d);
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const providers = getServicesForDay(DAY_KEYS[dayIndex]);
    html += `<div class="cell${isToday ? ' today' : ''}"><div class="day-num">${d}</div>`;
    providers.slice(0, 2).forEach(p => {
      html += `<div style="font-size:11px;color:var(--muted)">${escapeHtml(p.name)}</div>`;
    });
    if (providers.length > 2) {
      html += `<div style="font-size:11px;color:var(--muted)">+${providers.length - 2}</div>`;
    }
    html += '</div>';
  }

  const totalCells = startOffset + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    html += '<div class="cell empty"></div>';
  }
  html += '</div>';
  grid.innerHTML = html;
}

export function openModal() {
  const modal = document.getElementById('addModal');
  if (!modal) return;

  triggerElement = document.activeElement;
  modal.style.display = 'flex';
  modal.classList.add('show');

  const dateInput = document.getElementById('evtDate');
  const serviceSelect = document.getElementById('evtService');
  const timeInput = document.getElementById('evtTime');

  setDefaultDate();
  populateServiceSelect();
  autoFillTime();

  if (dateInput) dateInput.focus();

  _keydownHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      handleFocusTrap(e);
    }
  };
  document.addEventListener('keydown', _keydownHandler);

  modal.addEventListener('click', handleModalClick);
  modal._clickHandler = handleModalClick;
}

export function closeModal() {
  const modal = document.getElementById('addModal');
  if (!modal) return;

  modal.style.display = 'none';
  modal.classList.remove('show');

  if (_keydownHandler) {
    document.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
  }

  if (modal._clickHandler) {
    modal.removeEventListener('click', modal._clickHandler);
    modal._clickHandler = null;
  }

  if (triggerElement && typeof triggerElement.focus === 'function') {
    triggerElement.focus();
  }
  triggerElement = null;
}

function handleModalClick(e) {
  const modal = document.getElementById('addModal');
  if (!modal) return;
  if (e.target === modal) {
    closeModal();
  }
}

function handleFocusTrap(e) {
  const modal = document.getElementById('addModal');
  if (!modal) return;
  const focusable = modal.querySelectorAll(
    'input, select, button, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function saveEvent() {
  const dateInput = document.getElementById('evtDate');
  const serviceSelect = document.getElementById('evtService');
  const timeInput = document.getElementById('evtTime');

  if (!dateInput || !serviceSelect || !timeInput) return;

  const date = dateInput.value;
  const service = serviceSelect.value;
  const time = timeInput.value;

  if (!date || !service || !time) {
    alert('Please fill in all fields.');
    return;
  }

  const events = loadSchedule();
  events.push({ date, service, time, createdAt: new Date().toISOString() });
  localStorage.setItem('dublin-lifeline-schedule', JSON.stringify(events));

  alert('Event saved successfully!');
  closeModal();
}

export function loadSchedule() {
  try {
    const data = localStorage.getItem('dublin-lifeline-schedule');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function autoFillTime() {
  const timeInput = document.getElementById('evtTime');
  if (!timeInput) return;
  const now = new Date();
  timeInput.value = now.toTimeString().slice(0, 5);
}

export function setDefaultDate() {
  const dateInput = document.getElementById('evtDate');
  if (!dateInput) return;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

export function toggleGridFormat(fmt) {
  renderGrid(fmt);
}

function populateServiceSelect() {
  const select = document.getElementById('evtService');
  if (!select) return;
  const all = getAllServices();
  select.innerHTML = '<option value="">Select a service...</option>';
  all.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}
/* ============================================================
   GGULOOK Work Management App
   ============================================================ */

// ---------- Helpers ----------

function getBreakTime(hours) {
  if (hours >= 8) return 60;
  if (hours >= 4) return 30;
  return 0;
}

function formatBreak(minutes) {
  if (minutes === 60) return '1시간';
  if (minutes === 30) return '30분';
  return '없음';
}

function formatMoney(amount) {
  return '₩' + Math.round(amount).toLocaleString('ko-KR');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function dateKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function monthKey(year, month) {
  return `${year}-${pad2(month)}`;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function koreanDate(year, month, day) {
  const d = new Date(year, month - 1, day);
  return `${month}월 ${day}일 (${DAY_NAMES[d.getDay()]})`;
}

// ---------- Data ----------

const DEFAULT_DATA = {
  role: null,
  alba: { name: '', hourlyWage: 0, schedule: {} },
  boss: { shopName: '', workers: [], schedule: {}, payments: {} },
};

function loadData() {
  try {
    return JSON.parse(localStorage.getItem('ggulookData')) || JSON.parse(JSON.stringify(DEFAULT_DATA));
  } catch (_) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  localStorage.setItem('ggulookData', JSON.stringify(data));
}

// ---------- Screen Management ----------

function allScreens() {
  return [
    document.getElementById('role-select-screen'),
    document.getElementById('main-menu'),
    document.getElementById('game-screen'),
    document.getElementById('game-3d-screen'),
    document.getElementById('alba-screen'),
    document.getElementById('boss-screen'),
  ];
}

function showScreen(id) {
  allScreens().forEach(el => {
    if (!el) return;
    if (el.id === id) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

// ---------- Role Selection ----------

document.getElementById('btn-alba-role').addEventListener('click', () => {
  const data = loadData();
  data.role = 'alba';
  saveData(data);
  enterAlbaMode();
});

document.getElementById('btn-boss-role').addEventListener('click', () => {
  const data = loadData();
  data.role = 'boss';
  saveData(data);
  enterBossMode();
});

document.getElementById('btn-games-mode').addEventListener('click', () => {
  showScreen('main-menu');
});

document.getElementById('game-menu-back').addEventListener('click', () => {
  showScreen('role-select-screen');
});

// "← 역할 선택" buttons on setup screens and app headers
document.querySelectorAll('.back-to-role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    showScreen('role-select-screen');
  });
});

// ============================================================
// ALBA MODE
// ============================================================

let albaViewYear = new Date().getFullYear();
let albaViewMonth = new Date().getMonth() + 1;
let albaCalYear = new Date().getFullYear();
let albaCalMonth = new Date().getMonth() + 1;
let albaSelectedDate = null;

function enterAlbaMode() {
  showScreen('alba-screen');
  const data = loadData();
  if (!data.alba.name) {
    document.getElementById('alba-setup').classList.remove('hidden');
    document.getElementById('alba-main').classList.add('hidden');
  } else {
    showAlbaMain();
  }
}

// Setup save
document.getElementById('alba-setup-save').addEventListener('click', () => {
  const name = document.getElementById('alba-name-input').value.trim();
  const wage = parseFloat(document.getElementById('alba-wage-input').value) || 0;
  if (!name) { alert('이름을 입력해주세요.'); return; }
  if (!wage) { alert('시급을 입력해주세요.'); return; }
  const data = loadData();
  data.alba.name = name;
  data.alba.hourlyWage = wage;
  saveData(data);
  showAlbaMain();
});

document.getElementById('alba-reset-btn').addEventListener('click', () => {
  if (!confirm('정보를 초기화하고 다시 설정하시겠어요?')) return;
  const data = loadData();
  data.alba.name = '';
  data.alba.hourlyWage = 0;
  saveData(data);
  document.getElementById('alba-setup').classList.remove('hidden');
  document.getElementById('alba-main').classList.add('hidden');
  document.getElementById('alba-name-input').value = '';
  document.getElementById('alba-wage-input').value = '';
});

function showAlbaMain() {
  document.getElementById('alba-setup').classList.add('hidden');
  document.getElementById('alba-main').classList.remove('hidden');
  albaViewYear = new Date().getFullYear();
  albaViewMonth = new Date().getMonth() + 1;
  albaCalYear = new Date().getFullYear();
  albaCalMonth = new Date().getMonth() + 1;
  refreshAlbaHome();
  refreshAlbaCal();
}

// Tab switching
document.querySelectorAll('#alba-main .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#alba-main .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    document.querySelectorAll('#alba-main .tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== target);
    });
  });
});

// Alba Home month navigation
document.getElementById('alba-month-prev').addEventListener('click', () => {
  albaViewMonth--;
  if (albaViewMonth < 1) { albaViewMonth = 12; albaViewYear--; }
  refreshAlbaHome();
});
document.getElementById('alba-month-next').addEventListener('click', () => {
  albaViewMonth++;
  if (albaViewMonth > 12) { albaViewMonth = 1; albaViewYear++; }
  refreshAlbaHome();
});

function refreshAlbaHome() {
  const data = loadData();
  const label = `${albaViewYear}년 ${albaViewMonth}월`;
  document.getElementById('alba-home-month-label').textContent = label;

  // Calculate monthly hours and salary
  const mk = monthKey(albaViewYear, albaViewMonth);
  let totalHours = 0;
  const schedule = data.alba.schedule || {};
  Object.entries(schedule).forEach(([k, h]) => {
    if (k.startsWith(mk)) totalHours += h;
  });

  const salary = totalHours * data.alba.hourlyWage;
  document.getElementById('alba-monthly-salary').textContent = formatMoney(salary);
  document.getElementById('alba-work-summary').textContent =
    `총 ${totalHours}시간 근무 · 시급 ${formatMoney(data.alba.hourlyWage)}`;
  document.getElementById('alba-user-name').textContent = data.alba.name || '알바생';

  renderAlbaMiniCal(albaViewYear, albaViewMonth, schedule);
}

function renderAlbaMiniCal(year, month, schedule) {
  const mk = monthKey(year, month);
  const container = document.getElementById('alba-monthly-cal');
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  let html = DAY_NAMES.map(d => `<div class="mini-cal-header">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += `<div class="mini-cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(year, month, d);
    const h = schedule[k] || 0;
    html += `<div class="mini-cal-day${h > 0 ? ' has-work' : ''}">${d}</div>`;
  }
  container.innerHTML = html;
}

// Alba Calendar month navigation
document.getElementById('alba-cal-prev').addEventListener('click', () => {
  albaCalMonth--;
  if (albaCalMonth < 1) { albaCalMonth = 12; albaCalYear--; }
  refreshAlbaCal();
});
document.getElementById('alba-cal-next').addEventListener('click', () => {
  albaCalMonth++;
  if (albaCalMonth > 12) { albaCalMonth = 1; albaCalYear++; }
  refreshAlbaCal();
});

function refreshAlbaCal() {
  document.getElementById('alba-cal-month-label').textContent =
    `${albaCalYear}년 ${albaCalMonth}월`;
  renderAlbaCalendar();
  refreshAlbaWeekSummary();
}

function renderAlbaCalendar() {
  const data = loadData();
  const schedule = data.alba.schedule || {};
  const daysInMonth = new Date(albaCalYear, albaCalMonth, 0).getDate();
  const firstDay = new Date(albaCalYear, albaCalMonth - 1, 1).getDay();
  const today = new Date();

  const grid = document.getElementById('alba-calendar-grid');
  let html = DAY_NAMES.map((d, i) => {
    const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
    return `<div class="cal-day-header ${cls}">${d}</div>`;
  }).join('');

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(albaCalYear, albaCalMonth, d);
    const hours = schedule[k] || 0;
    const dow = new Date(albaCalYear, albaCalMonth - 1, d).getDay();
    const isToday = today.getFullYear() === albaCalYear && (today.getMonth() + 1) === albaCalMonth && today.getDate() === d;
    const dowCls = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : '';
    const badgeHtml = hours > 0
      ? `<span class="day-badge has-hours">${hours}h</span>`
      : '';
    html += `<div class="cal-day ${dowCls}${isToday ? ' today' : ''}" data-date="${k}">
               <span class="day-num">${d}</span>${badgeHtml}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => openAlbaDateModal(cell.dataset.date));
  });
}

function refreshAlbaWeekSummary() {
  const data = loadData();
  const schedule = data.alba.schedule || {};
  const today = new Date();
  // Find monday of this week relative to today
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  let weekTotal = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const k = dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    weekTotal += schedule[k] || 0;
  }

  const capped = Math.min(weekTotal, 52);
  document.getElementById('alba-weekly-total').textContent = `${weekTotal} / 52시간`;
  document.getElementById('alba-weekly-progress').style.width = `${(capped / 52) * 100}%`;
  document.getElementById('alba-weekly-progress').classList.toggle('over-limit', weekTotal >= 52);
  document.getElementById('alba-limit-warning').classList.toggle('hidden', weekTotal < 52);
}

// Alba date modal
function openAlbaDateModal(dateStr) {
  albaSelectedDate = dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const data = loadData();
  const hours = data.alba.schedule?.[dateStr] || 0;

  document.getElementById('alba-modal-date-title').textContent = koreanDate(y, m, d);
  document.getElementById('alba-modal-hours').value = hours || '';
  updateAlbaModalBreakInfo(hours);
  document.getElementById('alba-date-modal').classList.remove('hidden');
}

document.getElementById('alba-modal-hours').addEventListener('input', e => {
  updateAlbaModalBreakInfo(parseFloat(e.target.value) || 0);
});

function updateAlbaModalBreakInfo(hours) {
  const brk = getBreakTime(hours);
  const el = document.getElementById('alba-modal-break-info');
  if (hours === 0) { el.textContent = ''; return; }
  el.textContent = `휴게시간: ${formatBreak(brk)} (근로기준법 기준)`;
}

document.getElementById('alba-modal-close').addEventListener('click', closeAlbaModal);

document.getElementById('alba-date-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAlbaModal();
});

function closeAlbaModal() {
  document.getElementById('alba-date-modal').classList.add('hidden');
  albaSelectedDate = null;
}

document.getElementById('alba-modal-save').addEventListener('click', () => {
  if (!albaSelectedDate) return;
  let hours = parseFloat(document.getElementById('alba-modal-hours').value) || 0;
  if (hours < 0) hours = 0;
  if (hours > 24) hours = 24;

  // Check 52h weekly limit
  const data = loadData();
  const schedule = data.alba.schedule || {};
  const [y, m, d] = albaSelectedDate.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const monday = new Date(y, m - 1, d);
  monday.setDate(d - (dow === 0 ? 6 : dow - 1));

  let weekTotal = 0;
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    const k = dateKey(dd.getFullYear(), dd.getMonth() + 1, dd.getDate());
    if (k !== albaSelectedDate) weekTotal += schedule[k] || 0;
  }

  if (weekTotal + hours > 52) {
    const allowed = Math.max(0, 52 - weekTotal);
    hours = allowed;
    document.getElementById('alba-modal-hours').value = hours;
    const warning = document.getElementById('alba-limit-warning');
    warning.classList.remove('hidden', 'shake');
    void warning.offsetWidth;
    warning.classList.add('shake');
    if (allowed === 0) {
      alert('이번 주 근로시간이 이미 52시간에 도달했습니다.');
      return;
    }
    alert(`이번 주 최대 ${allowed}시간까지만 입력 가능합니다. (52시간 법적 최대치)`);
  }

  if (!data.alba.schedule) data.alba.schedule = {};
  if (hours === 0) {
    delete data.alba.schedule[albaSelectedDate];
  } else {
    data.alba.schedule[albaSelectedDate] = hours;
  }
  saveData(data);
  closeAlbaModal();
  renderAlbaCalendar();
  refreshAlbaWeekSummary();
  refreshAlbaHome();
});

// ============================================================
// BOSS MODE
// ============================================================

let bossHomeYear = new Date().getFullYear();
let bossHomeMonth = new Date().getMonth() + 1;
let bossCalYear = new Date().getFullYear();
let bossCalMonth = new Date().getMonth() + 1;
let bossSelectedDate = null;

// Temporary worker list during setup
let setupWorkers = [];

function enterBossMode() {
  showScreen('boss-screen');
  const data = loadData();
  if (!data.boss.shopName) {
    setupWorkers = JSON.parse(JSON.stringify(data.boss.workers || []));
    renderSetupWorkerList();
    document.getElementById('boss-setup').classList.remove('hidden');
    document.getElementById('boss-main').classList.add('hidden');
  } else {
    showBossMain();
  }
}

// Setup: add worker
document.getElementById('add-worker-btn').addEventListener('click', () => {
  const name = document.getElementById('new-worker-name').value.trim();
  const wage = parseFloat(document.getElementById('new-worker-wage').value) || 0;
  if (!name) { alert('이름을 입력해주세요.'); return; }
  if (!wage) { alert('시급을 입력해주세요.'); return; }
  setupWorkers.push({ id: 'w' + Date.now(), name, hourlyWage: wage });
  renderSetupWorkerList();
  document.getElementById('new-worker-name').value = '';
  document.getElementById('new-worker-wage').value = '';
});

function renderSetupWorkerList() {
  const container = document.getElementById('worker-list-setup');
  if (setupWorkers.length === 0) {
    container.innerHTML = '<p style="opacity:0.5;font-size:0.88rem;margin:8px 0">추가된 알바생이 없습니다.</p>';
    return;
  }
  container.innerHTML = setupWorkers.map((w, i) => `
    <div class="worker-setup-item">
      <span>${w.name} · 시급 ${formatMoney(w.hourlyWage)}</span>
      <button class="remove-btn" data-idx="${i}">삭제</button>
    </div>`).join('');
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setupWorkers.splice(Number(btn.dataset.idx), 1);
      renderSetupWorkerList();
    });
  });
}

// Setup save
document.getElementById('boss-setup-save').addEventListener('click', () => {
  const shopName = document.getElementById('boss-shop-input').value.trim();
  if (!shopName) { alert('업장 이름을 입력해주세요.'); return; }
  const data = loadData();
  data.boss.shopName = shopName;
  data.boss.workers = setupWorkers;
  saveData(data);
  showBossMain();
});

document.getElementById('boss-reset-btn').addEventListener('click', () => {
  if (!confirm('업장 정보를 초기화하고 다시 설정하시겠어요?')) return;
  const data = loadData();
  data.boss.shopName = '';
  saveData(data);
  setupWorkers = JSON.parse(JSON.stringify(data.boss.workers || []));
  renderSetupWorkerList();
  document.getElementById('boss-shop-input').value = '';
  document.getElementById('boss-setup').classList.remove('hidden');
  document.getElementById('boss-main').classList.add('hidden');
});

function showBossMain() {
  document.getElementById('boss-setup').classList.add('hidden');
  document.getElementById('boss-main').classList.remove('hidden');
  bossHomeYear = new Date().getFullYear();
  bossHomeMonth = new Date().getMonth() + 1;
  bossCalYear = new Date().getFullYear();
  bossCalMonth = new Date().getMonth() + 1;
  refreshBossHome();
  refreshBossCal();
}

// Tab switching
document.querySelectorAll('#boss-main .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#boss-main .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.target;
    document.querySelectorAll('#boss-main .tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== target);
    });
  });
});

// Boss home month navigation
document.getElementById('boss-home-prev').addEventListener('click', () => {
  bossHomeMonth--;
  if (bossHomeMonth < 1) { bossHomeMonth = 12; bossHomeYear--; }
  refreshBossHome();
});
document.getElementById('boss-home-next').addEventListener('click', () => {
  bossHomeMonth++;
  if (bossHomeMonth > 12) { bossHomeMonth = 1; bossHomeYear++; }
  refreshBossHome();
});

function refreshBossHome() {
  const data = loadData();
  document.getElementById('boss-home-month-label').textContent =
    `${bossHomeYear}년 ${bossHomeMonth}월`;
  document.getElementById('boss-shop-name-display').textContent =
    data.boss.shopName || '내 업장';

  const mk = monthKey(bossHomeYear, bossHomeMonth);
  const workers = data.boss.workers || [];
  const schedule = data.boss.schedule || {};
  const payments = data.boss.payments || {};

  // Per-worker monthly hours & salary
  const workerHours = {};
  workers.forEach(w => { workerHours[w.id] = 0; });
  Object.entries(schedule).forEach(([k, shifts]) => {
    if (!k.startsWith(mk)) return;
    shifts.forEach(s => {
      if (workerHours[s.workerId] !== undefined) workerHours[s.workerId] += s.hours;
    });
  });

  let totalPayout = 0;
  workers.forEach(w => {
    totalPayout += workerHours[w.id] * w.hourlyWage;
  });

  document.getElementById('boss-total-payout').textContent = formatMoney(totalPayout);

  const list = document.getElementById('boss-worker-pay-list');
  if (workers.length === 0) {
    list.innerHTML = '<p style="opacity:0.5;font-size:0.9rem;text-align:center;padding:20px">등록된 알바생이 없습니다.</p>';
    return;
  }

  list.innerHTML = workers.map(w => {
    const h = workerHours[w.id] || 0;
    const pay = h * w.hourlyWage;
    const paid = payments[mk]?.[w.id] || false;
    return `
      <div class="worker-pay-card">
        <div class="worker-pay-avatar">${w.name[0]}</div>
        <div class="worker-pay-info">
          <div class="worker-pay-name">${w.name}</div>
          <div class="worker-pay-detail">${h}시간 · 시급 ${formatMoney(w.hourlyWage)}</div>
        </div>
        <span class="worker-pay-amount">${formatMoney(pay)}</span>
        <button class="pay-accept-btn ${paid ? 'paid' : 'unpaid'}"
                data-worker-id="${w.id}"
                data-mk="${mk}"
                ${paid ? 'disabled' : ''}>
          ${paid ? '✓ 지급완료' : '지급 수락'}
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('.pay-accept-btn.unpaid').forEach(btn => {
    btn.addEventListener('click', () => {
      const data = loadData();
      if (!data.boss.payments[btn.dataset.mk]) data.boss.payments[btn.dataset.mk] = {};
      data.boss.payments[btn.dataset.mk][btn.dataset.workerId] = true;
      saveData(data);
      refreshBossHome();
    });
  });
}

// Boss calendar month navigation
document.getElementById('boss-cal-prev').addEventListener('click', () => {
  bossCalMonth--;
  if (bossCalMonth < 1) { bossCalMonth = 12; bossCalYear--; }
  refreshBossCal();
});
document.getElementById('boss-cal-next').addEventListener('click', () => {
  bossCalMonth++;
  if (bossCalMonth > 12) { bossCalMonth = 1; bossCalYear++; }
  refreshBossCal();
});

function refreshBossCal() {
  document.getElementById('boss-cal-month-label').textContent =
    `${bossCalYear}년 ${bossCalMonth}월`;
  renderBossCalendar();
}

function renderBossCalendar() {
  const data = loadData();
  const schedule = data.boss.schedule || {};
  const mk = monthKey(bossCalYear, bossCalMonth);
  const daysInMonth = new Date(bossCalYear, bossCalMonth, 0).getDate();
  const firstDay = new Date(bossCalYear, bossCalMonth - 1, 1).getDay();
  const today = new Date();

  const grid = document.getElementById('boss-calendar-grid');
  let html = DAY_NAMES.map((d, i) => {
    const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
    return `<div class="cal-day-header ${cls}">${d}</div>`;
  }).join('');

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(bossCalYear, bossCalMonth, d);
    const shifts = schedule[k] || [];
    const workerCount = shifts.length;
    const dow = new Date(bossCalYear, bossCalMonth - 1, d).getDay();
    const isToday = today.getFullYear() === bossCalYear && (today.getMonth() + 1) === bossCalMonth && today.getDate() === d;
    const dowCls = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : '';
    const badgeHtml = workerCount > 0
      ? `<span class="day-badge has-workers">${workerCount}명</span>`
      : '';
    html += `<div class="cal-day ${dowCls}${isToday ? ' today' : ''}" data-date="${k}">
               <span class="day-num">${d}</span>${badgeHtml}</div>`;
  }

  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => openBossDatePanel(cell.dataset.date));
  });
}

// Boss date panel
function openBossDatePanel(dateStr) {
  bossSelectedDate = dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  document.getElementById('boss-panel-date-title').textContent = koreanDate(y, m, d);
  renderBossPanelSchedule();
  renderBossMonthlyPay();
  populateWorkerSelect();
  document.getElementById('boss-date-panel').classList.remove('hidden');
}

document.getElementById('boss-panel-close').addEventListener('click', () => {
  document.getElementById('boss-date-panel').classList.add('hidden');
  bossSelectedDate = null;
});

document.getElementById('boss-date-panel').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('boss-date-panel').classList.add('hidden');
    bossSelectedDate = null;
  }
});

function populateWorkerSelect() {
  const data = loadData();
  const workers = data.boss.workers || [];
  const sel = document.getElementById('shift-worker-select');
  sel.innerHTML = workers.length === 0
    ? '<option value="">알바생 없음</option>'
    : workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
}

function renderBossPanelSchedule() {
  const data = loadData();
  const shifts = data.boss.schedule?.[bossSelectedDate] || [];
  const workers = data.boss.workers || [];
  const workerMap = Object.fromEntries(workers.map(w => [w.id, w]));

  const list = document.getElementById('boss-schedule-list');
  if (shifts.length === 0) {
    list.innerHTML = '<p style="opacity:0.5;font-size:0.88rem;margin:8px 0 12px">등록된 스케줄이 없습니다.</p>';
    return;
  }

  list.innerHTML = shifts.map((s, idx) => {
    const w = workerMap[s.workerId];
    if (!w) return '';
    const pay = s.hours * w.hourlyWage;
    return `
      <div class="schedule-item">
        <span class="schedule-item-name">${w.name}</span>
        <span class="schedule-item-hours">${s.hours}h</span>
        <span class="schedule-item-pay">${formatMoney(pay)}</span>
        <button class="schedule-delete-btn" data-idx="${idx}">삭제</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.schedule-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const data = loadData();
      const shifts = data.boss.schedule?.[bossSelectedDate] || [];
      shifts.splice(Number(btn.dataset.idx), 1);
      if (shifts.length === 0) delete data.boss.schedule[bossSelectedDate];
      else data.boss.schedule[bossSelectedDate] = shifts;
      saveData(data);
      renderBossPanelSchedule();
      renderBossMonthlyPay();
      renderBossCalendar();
    });
  });
}

// Add shift
document.getElementById('add-shift-btn').addEventListener('click', () => {
  if (!bossSelectedDate) return;
  const workerId = document.getElementById('shift-worker-select').value;
  const hours = parseFloat(document.getElementById('shift-hours-input').value) || 0;
  if (!workerId) { alert('알바생을 선택해주세요.'); return; }
  if (hours <= 0) { alert('시간을 입력해주세요.'); return; }

  const data = loadData();
  if (!data.boss.schedule) data.boss.schedule = {};
  if (!data.boss.schedule[bossSelectedDate]) data.boss.schedule[bossSelectedDate] = [];
  data.boss.schedule[bossSelectedDate].push({ workerId, hours });
  saveData(data);
  document.getElementById('shift-hours-input').value = '';
  renderBossPanelSchedule();
  renderBossMonthlyPay();
  renderBossCalendar();
  refreshBossHome();
});

function renderBossMonthlyPay() {
  const data = loadData();
  if (!bossSelectedDate) return;
  const [y, m] = bossSelectedDate.split('-').map(Number);
  const mk = monthKey(y, m);
  const workers = data.boss.workers || [];
  const schedule = data.boss.schedule || {};
  const payments = data.boss.payments || {};

  const workerHours = {};
  workers.forEach(w => { workerHours[w.id] = 0; });
  Object.entries(schedule).forEach(([k, shifts]) => {
    if (!k.startsWith(mk)) return;
    shifts.forEach(s => {
      if (workerHours[s.workerId] !== undefined) workerHours[s.workerId] += s.hours;
    });
  });

  const list = document.getElementById('boss-monthly-pay-list');
  if (workers.length === 0) {
    list.innerHTML = '<p style="opacity:0.5;font-size:0.88rem">등록된 알바생이 없습니다.</p>';
    return;
  }

  list.innerHTML = workers.map(w => {
    const h = workerHours[w.id] || 0;
    const pay = h * w.hourlyWage;
    const paid = payments[mk]?.[w.id] || false;
    return `
      <div class="monthly-pay-row">
        <div class="monthly-pay-name">${w.name}<br>
          <span style="font-weight:400;font-size:0.8rem;opacity:0.6">${h}시간 근무</span>
        </div>
        <span class="monthly-pay-total">${formatMoney(pay)}</span>
        <button class="pay-accept-btn ${paid ? 'paid' : 'unpaid'}"
                data-worker-id="${w.id}" data-mk="${mk}"
                ${paid ? 'disabled' : ''}>
          ${paid ? '✓ 지급완료' : '지급 수락'}
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('.pay-accept-btn.unpaid').forEach(btn => {
    btn.addEventListener('click', () => {
      const data = loadData();
      if (!data.boss.payments[btn.dataset.mk]) data.boss.payments[btn.dataset.mk] = {};
      data.boss.payments[btn.dataset.mk][btn.dataset.workerId] = true;
      saveData(data);
      renderBossMonthlyPay();
      refreshBossHome();
    });
  });
}

// ============================================================
// INIT: Restore last session role on page load
// ============================================================

(function init() {
  const data = loadData();
  if (data.role === 'alba' && data.alba.name) {
    enterAlbaMode();
  } else if (data.role === 'boss' && data.boss.shopName) {
    enterBossMode();
  } else {
    showScreen('role-select-screen');
  }
})();

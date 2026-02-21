/* Win The Day — v2.0.0 — Complete Rebuild */
(function () {
  'use strict';
  const VERSION = 'v2.0.0';
  const CATS = ['personal', 'professional', 'home', 'kids'];
  const CAT_ICONS = { personal: '◆', professional: '▲', home: '●', kids: '★' };
  let currentCat = CATS[0];
  let currentSub = 'daily';

  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const el = (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && k.length > 2) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); });
    return e;
  };

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function shortDate(iso) { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

  /* ── Data ──────────────────────────────────────── */
  function getCfg(cat) { try { return JSON.parse(localStorage.getItem(`wtd_cfg_${cat}`)) || null; } catch { return null; } }
  function saveCfg(cat, c) { localStorage.setItem(`wtd_cfg_${cat}`, JSON.stringify(c)); }
  function getEntries(cat) { try { return JSON.parse(localStorage.getItem(`wtd_ent_${cat}`)) || []; } catch { return []; } }
  function saveEntries(cat, a) { localStorage.setItem(`wtd_ent_${cat}`, JSON.stringify(a)); }

  function getWinRate(cat) {
    const e = getEntries(cat);
    if (!e.length) return { total: 0, wins: 0, rate: 0, streak: 0 };
    const wins = e.filter(x => x.success).length;
    let streak = 0;
    const sorted = [...e].sort((a, b) => b.date.localeCompare(a.date));
    for (const x of sorted) { if (x.success) streak++; else break; }
    return { total: e.length, wins, rate: Math.round((wins / e.length) * 100), streak };
  }

  /* ── Toast ──────────────────────────────────────── */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  /* ── Navigation ─────────────────────────────────── */
  const main = $('#main');

  function buildCatNav() {
    const nav = $('#cat-nav');
    nav.innerHTML = '';
    CATS.forEach(cat => {
      const btn = el('button', {
        className: `cat-btn${cat === currentCat ? ' active' : ''}`,
        text: `${CAT_ICONS[cat]} ${cat}`,
        onClick: () => { currentCat = cat; currentSub = 'daily'; render(); }
      });
      nav.appendChild(btn);
    });
  }

  function buildSubNav() {
    const nav = $('#sub-nav');
    nav.innerHTML = '';
    ['daily', 'setup', 'progress'].forEach(sub => {
      const btn = el('button', {
        className: `sub-btn${sub === currentSub ? ' active' : ''}`,
        text: sub.charAt(0).toUpperCase() + sub.slice(1),
        onClick: () => { currentSub = sub; render(); }
      });
      nav.appendChild(btn);
    });
  }

  function updateScoreBadge() {
    const badge = $('#score-badge');
    const stats = getWinRate(currentCat);
    badge.textContent = stats.total ? `${stats.rate}% Win Rate` : '';
  }

  function render() {
    buildCatNav();
    buildSubNav();
    updateScoreBadge();
    main.innerHTML = '';
    main.style.animation = 'none';
    void main.offsetHeight;
    main.style.animation = 'fadeUp .35s ease-out';
    switch (currentSub) {
      case 'daily': renderDaily(); break;
      case 'setup': renderSetup(); break;
      case 'progress': renderProgress(); break;
    }
  }

  /* ── Daily ──────────────────────────────────────── */
  function renderDaily() {
    const cfg = getCfg(currentCat);
    const catName = currentCat.charAt(0).toUpperCase() + currentCat.slice(1);

    if (!cfg || !cfg.tasks || !cfg.tasks.length) {
      main.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', text: CAT_ICONS[currentCat] }),
        el('p', { text: `No lead measures set for ${catName}. Configure them first.` }),
        el('button', { className: 'btn btn-primary', text: 'Set Up Now', style: 'margin-top:1rem;max-width:200px;margin-left:auto;margin-right:auto', onClick: () => { currentSub = 'setup'; render(); } })
      ]));
      return;
    }

    const today = todayISO();
    const entries = getEntries(currentCat);
    const existing = entries.find(e => e.date === today);
    const stats = getWinRate(currentCat);

    // Score card
    if (stats.total > 0) {
      const sc = el('div', { className: 'score-card' });
      sc.appendChild(el('div', { className: 'score-big', text: `${stats.rate}%` }));
      sc.appendChild(el('div', { className: 'score-label', text: `${catName} Win Rate` }));
      const row = el('div', { className: 'score-row' });
      row.appendChild(el('div', { className: 'score-stat', html: `<div class="score-stat-num">${stats.wins}</div><div class="score-stat-label">Wins</div>` }));
      row.appendChild(el('div', { className: 'score-stat', html: `<div class="score-stat-num">${stats.total}</div><div class="score-stat-label">Days</div>` }));
      row.appendChild(el('div', { className: 'score-stat', html: `<div class="score-stat-num">${stats.streak}</div><div class="score-stat-label">Streak</div>` }));
      sc.appendChild(row);
      main.appendChild(sc);
    }

    main.appendChild(el('h2', { className: 'page-title', text: `${catName} — Today` }));
    main.appendChild(el('p', { className: 'page-subtitle', text: existing ? 'Update today\'s entry' : 'Check off your lead measures' }));

    // Task cards
    const taskStates = cfg.tasks.map((_, i) => existing?.completed_tasks?.[i] || false);
    const card = el('div', { className: 'card' });
    card.appendChild(el('div', { className: 'card-label', text: 'Daily Lead Measures' }));

    cfg.tasks.forEach((task, i) => {
      const item = el('div', { className: `task-item${taskStates[i] ? ' checked' : ''}` });
      item.appendChild(el('span', { className: 'task-num', text: `${i + 1}` }));
      item.appendChild(el('div', { className: 'task-check', text: '✓' }));
      item.appendChild(el('span', { className: 'task-text', text: task }));
      item.addEventListener('click', () => {
        taskStates[i] = !taskStates[i];
        item.classList.toggle('checked', taskStates[i]);
        updateWinStatus();
      });
      card.appendChild(item);
    });
    main.appendChild(card);

    // Win status
    const winDiv = el('div', { id: 'win-status' });
    main.appendChild(winDiv);

    function updateWinStatus() {
      const count = taskStates.filter(Boolean).length;
      const total = cfg.tasks.length;
      const isWin = count >= Math.min(4, total);
      winDiv.innerHTML = '';
      const bar = el('div', { className: 'progress-bar-wrap' });
      bar.appendChild(el('div', { className: 'progress-bar-fill', style: `width:${(count / total) * 100}%` }));
      winDiv.appendChild(bar);
      winDiv.appendChild(el('div', { className: `win-banner ${isWin ? 'win' : 'lose'}`, text: isWin ? `✓ ${count}/${total} — You're winning today!` : `${count}/${total} — Complete at least 4 to win` }));
    }
    updateWinStatus();

    // Notes
    const noteCard = el('div', { className: 'card' });
    noteCard.appendChild(el('div', { className: 'card-label', text: 'Notes' }));
    const noteArea = el('textarea', { className: 'input-field', placeholder: 'Reflections, wins, lessons...', rows: '3' });
    noteArea.value = existing?.note || '';
    noteCard.appendChild(noteArea);
    main.appendChild(noteCard);

    // Save
    const saveBtn = el('button', { className: 'btn btn-primary', text: existing ? '✓ Update Entry' : '◆ Record Day' });
    saveBtn.addEventListener('click', () => {
      const count = taskStates.filter(Boolean).length;
      const total = cfg.tasks.length;
      const entry = {
        date: today,
        completed: count,
        tasksTotal: total,
        completed_tasks: taskStates,
        success: count >= Math.min(4, total),
        note: noteArea.value.trim(),
        timestamp: new Date().toISOString()
      };
      const idx = entries.findIndex(e => e.date === today);
      if (idx >= 0) entries[idx] = entry; else entries.push(entry);
      saveEntries(currentCat, entries);
      toast(entry.success ? 'You won the day! 🏆' : 'Day recorded');
      setTimeout(() => render(), 300);
    });
    main.appendChild(saveBtn);

    // Goals sidebar
    if (cfg.weekly || cfg.monthly || cfg.annual) {
      const goals = el('div', { className: 'goals-section' });
      goals.appendChild(el('h4', { text: 'Goals' }));
      if (cfg.weekly) goals.appendChild(el('div', { className: 'goal-item', html: `<strong>Weekly:</strong> ${cfg.weekly}` }));
      if (cfg.monthly) goals.appendChild(el('div', { className: 'goal-item', html: `<strong>Monthly:</strong> ${cfg.monthly}` }));
      if (cfg.annual) goals.appendChild(el('div', { className: 'goal-item', html: `<strong>Annual:</strong> ${cfg.annual}` }));
      main.appendChild(goals);
    }
  }

  /* ── Setup ──────────────────────────────────────── */
  function renderSetup() {
    const cfg = getCfg(currentCat) || {};
    const catName = currentCat.charAt(0).toUpperCase() + currentCat.slice(1);
    main.appendChild(el('h2', { className: 'page-title', text: `${catName} Setup` }));
    main.appendChild(el('p', { className: 'page-subtitle', text: 'Define your daily lead measures and goals' }));

    const card = el('div', { className: 'card' });
    const form = el('form');

    // Start date
    const g1 = el('div', { className: 'form-group' });
    g1.appendChild(el('label', { text: 'Start Date' }));
    g1.appendChild(el('input', { className: 'input-field', type: 'date', id: 's-start', value: cfg.startDate || todayISO() }));
    form.appendChild(g1);

    // Length
    const g2 = el('div', { className: 'form-group' });
    g2.appendChild(el('label', { text: 'Program Length (days)' }));
    g2.appendChild(el('input', { className: 'input-field', type: 'number', id: 's-len', min: '28', max: '365', value: cfg.length || '112' }));
    form.appendChild(g2);

    // Reminder
    const g3 = el('div', { className: 'form-group' });
    g3.appendChild(el('label', { text: 'Daily Reminder Time' }));
    g3.appendChild(el('input', { className: 'input-field', type: 'time', id: 's-time', value: cfg.reminder || '08:00' }));
    form.appendChild(g3);

    // Tasks
    const fs = el('fieldset');
    fs.appendChild(el('legend', { text: 'Daily Lead Measures (up to 5)' }));
    for (let i = 0; i < 5; i++) {
      fs.appendChild(el('input', { className: 'input-field', type: 'text', id: `s-task${i}`, placeholder: `Lead measure ${i + 1}`, value: cfg.tasks?.[i] || '' }));
    }
    form.appendChild(fs);

    // Goals
    const g4 = el('div', { className: 'form-group' });
    g4.appendChild(el('label', { text: 'Weekly Goal' }));
    g4.appendChild(el('input', { className: 'input-field', type: 'text', id: 's-weekly', placeholder: 'Optional weekly goal', value: cfg.weekly || '' }));
    form.appendChild(g4);

    const g5 = el('div', { className: 'form-group' });
    g5.appendChild(el('label', { text: 'Monthly Goal' }));
    g5.appendChild(el('input', { className: 'input-field', type: 'text', id: 's-monthly', placeholder: 'Optional monthly goal', value: cfg.monthly || '' }));
    form.appendChild(g5);

    const g6 = el('div', { className: 'form-group' });
    g6.appendChild(el('label', { text: 'Annual Goal' }));
    g6.appendChild(el('input', { className: 'input-field', type: 'text', id: 's-annual', placeholder: 'Optional annual goal', value: cfg.annual || '' }));
    form.appendChild(g6);

    const saveBtn = el('button', { className: 'btn btn-primary', type: 'submit', text: cfg.tasks ? 'Update Setup' : 'Save & Start' });
    form.appendChild(saveBtn);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const v = $(`#s-task${i}`).value.trim();
        if (v) tasks.push(v);
      }
      if (!tasks.length) { toast('Add at least one lead measure'); return; }
      const newCfg = {
        startDate: $('#s-start').value,
        length: parseInt($('#s-len').value) || 112,
        reminder: $('#s-time').value,
        tasks,
        weekly: $('#s-weekly').value.trim(),
        monthly: $('#s-monthly').value.trim(),
        annual: $('#s-annual').value.trim()
      };
      saveCfg(currentCat, newCfg);
      toast('Setup saved ✓');
      currentSub = 'daily';
      render();
    });

    card.appendChild(form);
    main.appendChild(card);

    // Reset
    const resetBtn = el('button', { className: 'btn btn-danger', text: `Reset ${catName} Data`, style: 'margin-top:0.75rem' });
    resetBtn.addEventListener('click', () => {
      if (confirm(`Clear all ${catName} entries and config?`)) {
        localStorage.removeItem(`wtd_cfg_${currentCat}`);
        localStorage.removeItem(`wtd_ent_${currentCat}`);
        toast('Data cleared');
        render();
      }
    });
    main.appendChild(resetBtn);
  }

  /* ── Progress ───────────────────────────────────── */
  function renderProgress() {
    const entries = getEntries(currentCat).sort((a, b) => b.date.localeCompare(a.date));
    const cfg = getCfg(currentCat);
    const catName = currentCat.charAt(0).toUpperCase() + currentCat.slice(1);
    main.appendChild(el('h2', { className: 'page-title', text: `${catName} Progress` }));

    if (!entries.length) {
      main.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', text: '◷' }),
        el('p', { text: 'No entries recorded yet.' })
      ]));
      return;
    }

    const stats = getWinRate(currentCat);
    main.appendChild(el('p', { className: 'page-subtitle', text: `${stats.total} days recorded · ${stats.wins} wins · ${stats.streak} day streak` }));

    // Win rate bar
    const barCard = el('div', { className: 'card' });
    barCard.appendChild(el('div', { className: 'card-label', text: 'Overall Win Rate' }));
    const bar = el('div', { className: 'progress-bar-wrap', style: 'height:12px' });
    bar.appendChild(el('div', { className: 'progress-bar-fill', style: `width:${stats.rate}%` }));
    barCard.appendChild(bar);
    barCard.appendChild(el('p', { style: 'text-align:center;font-size:1.2rem;font-weight:700;color:var(--gold-dark);margin-top:0.5rem', text: `${stats.rate}%` }));
    main.appendChild(barCard);

    // History
    const card = el('div', { className: 'card' });
    card.appendChild(el('div', { className: 'card-label', text: 'Day-by-Day' }));
    entries.forEach(e => {
      const row = el('div', { className: 'history-row' });
      row.appendChild(el('span', { className: `history-dot ${e.success ? 'win' : 'loss'}` }));
      row.appendChild(el('span', { className: 'history-date', text: shortDate(e.date) }));
      row.appendChild(el('span', { className: 'history-score', text: `${e.completed}/${e.tasksTotal}` }));
      row.appendChild(el('span', { className: 'history-note', text: e.note || '—' }));
      card.appendChild(row);
    });
    main.appendChild(card);

    // Export
    const expBtn = el('button', { className: 'btn btn-ghost', text: '↓ Export CSV', style: 'margin-top:0.75rem' });
    expBtn.addEventListener('click', () => {
      let csv = 'date,completed,total,win,note\n';
      entries.forEach(e => {
        csv += `${e.date},${e.completed},${e.tasksTotal},${e.success ? 'Yes' : 'No'},"${(e.note || '').replace(/"/g, '""')}"\n`;
      });
      const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${currentCat}-win-data.csv` });
      a.click();
      toast('CSV downloaded');
    });
    main.appendChild(expBtn);
  }

  /* ── Service Worker + Init ──────────────────────── */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});

  document.addEventListener('DOMContentLoaded', () => {
    const v = $('#version');
    if (v) v.textContent = VERSION;
    render();
  });
})();

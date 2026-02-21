/* Win The Day — v5.0.0 — Complete PWA */
(function () {
  'use strict';

  /* ────────────────────────────────────────────────
     Constants & State
  ──────────────────────────────────────────────── */
  var CATS = ['personal', 'professional', 'home', 'kids'];
  var CAT_LABELS = { personal: 'Personal', professional: 'Professional', home: 'Home', kids: 'Kids' };
  var CAT_ICONS = { personal: '\uD83E\uDDD8', professional: '\uD83D\uDCBC', home: '\uD83C\uDFE0', kids: '\uD83D\uDC68\u200D\uD83D\uDC67' };
  var CAT_COLORS = { personal: '#10b981', professional: '#3b82f6', home: '#a855f7', kids: '#f59e0b' };
  var PLACEHOLDERS = {
    personal: ['Exercise 30 min', 'Read 20 pages', 'Meditate 10 min', 'Journal 5 min', 'Call a friend or family member'],
    professional: ['Make 5 calls', 'Write 500 words', 'Review pipeline', 'Network outreach', 'Learn 30 min'],
    home: ['Declutter 15 min', 'Meal prep', 'Family devotional', 'Laundry cycle', 'Budget check'],
    kids: ['Quality time 30 min', 'Homework help', 'Read together', 'Outdoor play', 'Creative activity']
  };

  var state = {
    currentCat: 'personal',
    currentSub: 'daily',
    expandedHistoryDate: null
  };

  var appEl;

  /* ────────────────────────────────────────────────
     Utility Functions
  ──────────────────────────────────────────────── */
  function $(sel, parent) { return (parent || document).querySelector(sel); }
  function $$(sel, parent) { return Array.from((parent || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'className') e.className = v;
        else if (k === 'textContent') e.textContent = v;
        else if (k.indexOf('on') === 0 && k.length > 2) {
          e.addEventListener(k.slice(2).toLowerCase(), v);
        }
        else e.setAttribute(k, v);
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (!c) return;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else e.appendChild(c);
      });
    }
    return e;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function formatDateLong(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateShort(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ────────────────────────────────────────────────
     Data Layer
  ──────────────────────────────────────────────── */
  function getAppData() {
    try { return JSON.parse(localStorage.getItem('wtd_app')) || {}; } catch (e) { return {}; }
  }
  function saveAppData(data) {
    localStorage.setItem('wtd_app', JSON.stringify(data));
  }
  function getCfg(cat) {
    try { return JSON.parse(localStorage.getItem('wtd_cfg_' + cat)) || null; } catch (e) { return null; }
  }
  function saveCfg(cat, cfg) {
    localStorage.setItem('wtd_cfg_' + cat, JSON.stringify(cfg));
  }
  function getEntries(cat) {
    try { return JSON.parse(localStorage.getItem('wtd_ent_' + cat)) || []; } catch (e) { return []; }
  }
  function saveEntries(cat, entries) {
    localStorage.setItem('wtd_ent_' + cat, JSON.stringify(entries));
  }

  function getStats(cat) {
    var entries = getEntries(cat);
    if (!entries.length) return { total: 0, wins: 0, losses: 0, rate: 0, streak: 0, bestStreak: 0 };
    var wins = entries.filter(function (x) { return x.success; }).length;
    var sorted = entries.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var streak = 0;
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].success) streak++; else break;
    }
    var bestStreak = 0;
    var run = 0;
    var chronological = entries.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    for (var j = 0; j < chronological.length; j++) {
      if (chronological[j].success) { run++; if (run > bestStreak) bestStreak = run; }
      else run = 0;
    }
    return {
      total: entries.length,
      wins: wins,
      losses: entries.length - wins,
      rate: Math.round((wins / entries.length) * 100),
      streak: streak,
      bestStreak: bestStreak
    };
  }

  function getOverallWinRate() {
    var totalEntries = 0;
    var totalWins = 0;
    CATS.forEach(function (cat) {
      var entries = getEntries(cat);
      totalEntries += entries.length;
      totalWins += entries.filter(function (x) { return x.success; }).length;
    });
    if (!totalEntries) return 0;
    return Math.round((totalWins / totalEntries) * 100);
  }

  function isWin(completedCount, totalTasks) {
    return completedCount >= Math.min(4, totalTasks);
  }

  /* ────────────────────────────────────────────────
     Toast System
  ──────────────────────────────────────────────── */
  var toastTimer;
  function showToast(msg) {
    var t = $('.toast-container');
    if (!t) {
      t = el('div', { className: 'toast-container' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    clearTimeout(toastTimer);
    t.classList.remove('show');
    void t.offsetHeight;
    t.classList.add('show');
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  /* ────────────────────────────────────────────────
     Modal System
  ──────────────────────────────────────────────── */
  function showModal(title, message, confirmText, onConfirm) {
    var overlay = el('div', { className: 'modal-overlay' });
    var box = el('div', { className: 'modal-box' }, [
      el('div', { className: 'modal-title', textContent: title }),
      el('div', { className: 'modal-text', textContent: message }),
      el('div', { className: 'modal-actions' }, [
        el('button', { className: 'btn btn-secondary', textContent: 'Cancel', onClick: function () { overlay.remove(); } }),
        el('button', { className: 'btn btn-danger', textContent: confirmText, onClick: function () { overlay.remove(); onConfirm(); } })
      ])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ────────────────────────────────────────────────
     Celebration
  ──────────────────────────────────────────────── */
  function celebrate() {
    var container = el('div', { className: 'celebration' });
    var colors = ['#10b981', '#34d399', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444', '#ec4899'];
    for (var i = 0; i < 40; i++) {
      var piece = el('div', { className: 'confetti-piece' });
      piece.style.left = Math.random() * 100 + '%';
      piece.style.top = '-10px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.5) + 's';
      piece.style.animationDuration = (1 + Math.random() * 1) + 's';
      piece.style.width = (6 + Math.random() * 8) + 'px';
      piece.style.height = (6 + Math.random() * 8) + 'px';
      container.appendChild(piece);
    }
    document.body.appendChild(container);
    setTimeout(function () { container.remove(); }, 2500);
  }

  /* ────────────────────────────────────────────────
     Onboarding
  ──────────────────────────────────────────────── */
  var obStep = 0;
  var obTotalSteps = 6;
  var obRevealed = 0;

  function renderOnboarding() {
    appEl.textContent = '';
    var overlay = el('div', { className: 'onboarding-overlay' });

    var content = el('div', { className: 'onboarding-content' });
    var footer = el('div', { className: 'onboarding-footer' });

    // Dots
    var dots = el('div', { className: 'onboarding-dots' });
    for (var i = 0; i < obTotalSteps; i++) {
      dots.appendChild(el('div', { className: 'onboarding-dot' + (i === obStep ? ' active' : '') }));
    }

    // Navigation buttons
    var nav = el('div', { className: 'onboarding-nav' });

    if (obStep > 0) {
      nav.appendChild(el('button', {
        className: 'btn btn-secondary',
        textContent: 'Back',
        onClick: function () { obStep--; renderOnboarding(); }
      }));
    }

    // Build step content
    switch (obStep) {
      case 0: buildObStep0(content, nav); break;
      case 1: buildObStep1(content, nav); break;
      case 2: buildObStep2(content, nav); break;
      case 3: buildObStep3(content, nav); break;
      case 4: buildObStep4(content, nav); break;
      case 5: buildObStep5(content, nav); break;
    }

    footer.appendChild(dots);
    footer.appendChild(nav);
    overlay.appendChild(content);
    overlay.appendChild(footer);
    appEl.appendChild(overlay);
  }

  /* Step 0: Welcome */
  function buildObStep0(content, nav) {
    content.appendChild(el('div', { className: 'ob-monogram', textContent: 'WTD' }));
    content.appendChild(el('div', { className: 'ob-title', textContent: 'Win The Day' }));
    content.appendChild(el('div', { className: 'ob-subtitle', textContent: 'Track the daily actions that drive real results' }));
    nav.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: "Let's Go \u2192",
      onClick: function () { obStep++; renderOnboarding(); }
    }));
  }

  /* Step 1: The Problem */
  function buildObStep1(content, nav) {
    content.appendChild(el('div', { className: 'ob-header', textContent: 'The Problem With Goals' }));

    var goalCard = el('div', { className: 'ob-goal-card' });
    goalCard.appendChild(document.createTextNode('Lose 20 pounds'));
    var xMark = el('div', { className: 'ob-goal-x', textContent: '\u2716' });
    goalCard.appendChild(xMark);
    content.appendChild(goalCard);

    var revealText = el('div', { className: 'ob-reveal-text' });
    var lines = [
      'Most people set goals, then stare at the scale hoping for change.',
      'They focus on the <em>RESULT</em> (a lag measure)...',
      'Instead of the <em>ACTIONS</em> (lead measures) that drive it.'
    ];
    var lineEls = [];
    lines.forEach(function (line) {
      var lineEl = el('div', { className: 'ob-reveal-line' });
      lineEl.innerHTML = line;
      revealText.appendChild(lineEl);
      lineEls.push(lineEl);
    });
    content.appendChild(revealText);

    // Animate after render
    setTimeout(function () {
      xMark.classList.add('show');
      lineEls.forEach(function (lineEl, idx) {
        setTimeout(function () { lineEl.classList.add('show'); }, 600 + idx * 600);
      });
    }, 300);

    nav.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: 'Next \u2192',
      onClick: function () { obStep++; renderOnboarding(); }
    }));
  }

  /* Step 2: Lead vs Lag (Interactive) */
  function buildObStep2(content, nav) {
    content.appendChild(el('div', { className: 'ob-header', textContent: 'Lead Measures vs Lag Measures' }));

    var expBox = el('div', { className: 'ob-explanation' });
    expBox.innerHTML = 'A <strong>LAG measure</strong> is the result \u2014 you can measure it, but you can\'t directly control it.<br><br>A <strong>LEAD measure</strong> is the daily action \u2014 you can control it, and it <strong>DRIVES</strong> the result.';
    content.appendChild(expBox);

    var scenarios = [
      { lag: 'Lose 20 lbs', lead: 'Exercise 30 min daily' },
      { lag: 'Close 10 new clients', lead: 'Make 15 prospecting calls/week' },
      { lag: 'Organized home', lead: 'Declutter one area for 15 min/day' }
    ];

    obRevealed = 0;
    var exercise = el('div', { className: 'ob-exercise' });
    var patternMsg = el('div', { className: 'ob-pattern-msg', textContent: 'See the pattern? Lead measures are specific, daily, and within your control.' });

    scenarios.forEach(function (sc, idx) {
      var scenario = el('div', { className: 'ob-scenario' });

      var lagSide = el('div', { className: 'ob-lag' }, [
        el('div', { className: 'ob-lag-label', textContent: 'LAG' }),
        el('div', { className: 'ob-lag-text', textContent: sc.lag })
      ]);
      scenario.appendChild(lagSide);

      scenario.appendChild(el('div', { className: 'ob-arrow', textContent: '\u2192' }));

      var leadSide = el('div', { className: 'ob-lead' });
      var leadLabel = el('div', { className: 'ob-lead-label', textContent: 'LEAD' });
      var leadHidden = el('div', { className: 'ob-lead-hidden' });

      var revBtn = el('button', { className: 'ob-reveal-btn', textContent: 'Reveal' });
      var leadText = el('div', { className: 'ob-lead-text', textContent: sc.lead });
      leadText.style.display = 'none';

      revBtn.addEventListener('click', function () {
        revBtn.style.display = 'none';
        leadText.style.display = 'block';
        obRevealed++;
        if (obRevealed >= 3) {
          patternMsg.classList.add('show');
        }
      });

      leadHidden.appendChild(revBtn);
      leadHidden.appendChild(leadText);
      leadSide.appendChild(leadLabel);
      leadSide.appendChild(leadHidden);
      scenario.appendChild(leadSide);
      exercise.appendChild(scenario);
    });

    content.appendChild(exercise);
    content.appendChild(patternMsg);

    nav.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: 'Next \u2192',
      onClick: function () { obStep++; renderOnboarding(); }
    }));
  }

  /* Step 3: How Winning Works */
  function buildObStep3(content, nav) {
    content.appendChild(el('div', { className: 'ob-header', textContent: 'How You Win The Day' }));

    var steps = [
      'Set 1\u20135 lead measures per category',
      'Check them off as you complete them',
      'Complete at least 4 \u2192 You WIN the day \uD83C\uDFC6',
      '(If fewer than 4 total: complete all to win)'
    ];

    var stepsContainer = el('div', { className: 'ob-steps' });
    steps.forEach(function (text, idx) {
      stepsContainer.appendChild(el('div', { className: 'ob-step-card' }, [
        el('div', { className: 'ob-step-num', textContent: String(idx + 1) }),
        el('div', { className: 'ob-step-text', textContent: text })
      ]));
    });
    content.appendChild(stepsContainer);

    // Demo card
    var demo = el('div', { className: 'ob-demo-card' });
    var demoTasks = ['Exercise 30 min', 'Read 20 pages', 'Meditate 10 min', 'Journal 5 min', 'Call a friend'];
    var demoChecked = [true, true, false, true, true];
    demoTasks.forEach(function (t, i) {
      var taskEl = el('div', { className: 'ob-demo-task' }, [
        el('div', { className: 'ob-demo-check ' + (demoChecked[i] ? 'done' : 'undone'), textContent: demoChecked[i] ? '\u2713' : '' }),
        el('div', { className: 'ob-demo-text' + (demoChecked[i] ? ' struck' : ''), textContent: t })
      ]);
      demo.appendChild(taskEl);
    });
    content.appendChild(demo);

    content.appendChild(el('div', { className: 'ob-win-demo', textContent: '\uD83C\uDFC6 You\'re winning the day!' }));
    content.appendChild(el('div', { className: 'ob-streak-note', textContent: 'String together wins to build unstoppable momentum' }));

    nav.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: 'Next \u2192',
      onClick: function () { obStep++; renderOnboarding(); }
    }));
  }

  /* Step 4: Categories */
  function buildObStep4(content, nav) {
    content.appendChild(el('div', { className: 'ob-header', textContent: 'Four Areas of Your Life' }));

    var grid = el('div', { className: 'ob-categories' });
    CATS.forEach(function (cat) {
      var card = el('div', { className: 'ob-cat-card' });
      card.style.borderColor = CAT_COLORS[cat];
      card.style.borderWidth = '2px';
      card.style.borderStyle = 'solid';
      card.appendChild(el('div', { className: 'ob-cat-icon', textContent: CAT_ICONS[cat] }));
      var nameEl = el('div', { className: 'ob-cat-name', textContent: CAT_LABELS[cat] });
      nameEl.style.color = CAT_COLORS[cat];
      card.appendChild(nameEl);
      grid.appendChild(card);
    });
    content.appendChild(grid);

    content.appendChild(el('div', { className: 'ob-subtitle', textContent: 'Each area gets its own lead measures. You\'ll set them up next.' }));

    nav.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: 'Next \u2192',
      onClick: function () { obStep++; renderOnboarding(); }
    }));
  }

  /* Step 5: Reflect */
  function buildObStep5(content, nav) {
    content.appendChild(el('div', { className: 'ob-header', textContent: 'What Matters Most?' }));
    content.appendChild(el('div', { className: 'ob-reflect-prompt', textContent: 'Think about your PERSONAL life. What\'s one small daily action that, done consistently, would transform it?' }));

    var chips = el('div', { className: 'ob-examples' });
    ['Exercise 30 minutes', 'Read for 20 minutes', 'Meditate for 10 minutes', 'Call a friend or family member'].forEach(function (ex) {
      chips.appendChild(el('div', { className: 'ob-example-chip', textContent: ex }));
    });
    content.appendChild(chips);

    content.appendChild(el('input', {
      className: 'ob-input',
      type: 'text',
      placeholder: 'Type your example measure (optional)...'
    }));

    content.appendChild(el('div', { className: 'ob-skip-text', textContent: 'Don\'t worry about getting it perfect. You\'ll set up all your measures in the app.' }));

    nav.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: 'Start Winning \u2192',
      onClick: function () {
        var appData = getAppData();
        appData.onboardingComplete = true;
        saveAppData(appData);
        renderApp();
      }
    }));
  }

  /* ────────────────────────────────────────────────
     Main App
  ──────────────────────────────────────────────── */
  function renderApp() {
    appEl.textContent = '';

    // Load saved state
    var appData = getAppData();
    if (appData.currentCategory && CATS.indexOf(appData.currentCategory) !== -1) {
      state.currentCat = appData.currentCategory;
    }

    // Header
    var header = el('div', { className: 'app-header' });
    var headerRow = el('div', { className: 'header-row' });
    var logo = el('div', { className: 'header-logo' });
    logo.innerHTML = 'Win <span>The Day</span>';
    headerRow.appendChild(logo);

    var overallRate = getOverallWinRate();
    var pill = el('div', { className: 'win-rate-pill', textContent: overallRate + '% WR' });
    headerRow.appendChild(pill);
    header.appendChild(headerRow);
    appEl.appendChild(header);

    // Category tabs
    var catTabs = el('div', { className: 'cat-tabs' });
    CATS.forEach(function (cat) {
      var tab = el('button', { className: 'cat-tab' + (cat === state.currentCat ? ' active' : '') });
      var dot = el('span', { className: 'cat-dot' });
      dot.style.background = CAT_COLORS[cat];
      tab.appendChild(dot);
      tab.appendChild(document.createTextNode(CAT_LABELS[cat]));
      if (cat === state.currentCat) {
        tab.style.borderBottomColor = CAT_COLORS[cat];
        tab.style.color = '#f1f5f9';
      }
      tab.addEventListener('click', function () {
        state.currentCat = cat;
        state.currentSub = 'daily';
        state.expandedHistoryDate = null;
        var ad = getAppData();
        ad.currentCategory = cat;
        saveAppData(ad);
        renderApp();
      });
      catTabs.appendChild(tab);
    });
    appEl.appendChild(catTabs);

    // Sub navigation
    var subNav = el('div', { className: 'sub-nav' });
    ['daily', 'setup', 'progress'].forEach(function (sub) {
      var tab = el('button', {
        className: 'sub-tab' + (sub === state.currentSub ? ' active' : ''),
        textContent: sub.charAt(0).toUpperCase() + sub.slice(1)
      });
      tab.addEventListener('click', function () {
        state.currentSub = sub;
        state.expandedHistoryDate = null;
        renderApp();
      });
      subNav.appendChild(tab);
    });
    appEl.appendChild(subNav);

    // Main content area
    var main = el('div', { className: 'main-content' });
    main.setAttribute('id', 'main-content');
    appEl.appendChild(main);

    switch (state.currentSub) {
      case 'daily': renderDaily(main); break;
      case 'setup': renderSetup(main); break;
      case 'progress': renderProgress(main); break;
    }

    // Bottom bar
    var bottomBar = el('div', { className: 'bottom-bar' });
    var bottomTabs = [
      { icon: '\uD83D\uDCCB', label: 'Daily', sub: 'daily' },
      { icon: '\u2699\uFE0F', label: 'Setup', sub: 'setup' },
      { icon: '\uD83D\uDCCA', label: 'Progress', sub: 'progress' }
    ];
    bottomTabs.forEach(function (bt) {
      var tab = el('button', {
        className: 'bottom-tab' + (bt.sub === state.currentSub ? ' active' : '')
      }, [
        el('span', { className: 'bottom-tab-icon', textContent: bt.icon }),
        el('span', { textContent: bt.label })
      ]);
      tab.addEventListener('click', function () {
        state.currentSub = bt.sub;
        state.expandedHistoryDate = null;
        renderApp();
      });
      bottomBar.appendChild(tab);
    });
    appEl.appendChild(bottomBar);
  }

  /* ────────────────────────────────────────────────
     Daily View
  ──────────────────────────────────────────────── */
  function renderDaily(main) {
    var cat = state.currentCat;
    var cfg = getCfg(cat);
    var catName = CAT_LABELS[cat];
    var color = CAT_COLORS[cat];

    if (!cfg || !cfg.tasks || !cfg.tasks.length) {
      var empty = el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', textContent: CAT_ICONS[cat] }),
        el('div', { className: 'empty-text', textContent: 'Set up your lead measures for ' + catName }),
        el('button', { className: 'btn btn-primary', textContent: 'Set Up \u2192', style: 'max-width:200px;margin:0 auto', onClick: function () { state.currentSub = 'setup'; renderApp(); } })
      ]);
      main.appendChild(empty);
      return;
    }

    var today = todayISO();
    var entries = getEntries(cat);
    var existing = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === today) { existing = entries[i]; break; }
    }
    var stats = getStats(cat);

    // Score card (if has entries)
    if (stats.total > 0) {
      var scoreCard = el('div', { className: 'score-card' });
      var grid = el('div', { className: 'score-grid' });

      var rateItem = el('div', { className: 'score-item' });
      var rateValue = el('div', { className: 'score-value big', textContent: stats.rate + '%' });
      rateValue.style.color = color;
      rateItem.appendChild(rateValue);
      rateItem.appendChild(el('div', { className: 'score-label', textContent: 'Win Rate' }));
      grid.appendChild(rateItem);

      var winsItem = el('div', { className: 'score-item' }, [
        el('div', { className: 'score-value', textContent: String(stats.wins) }),
        el('div', { className: 'score-label', textContent: 'Wins' })
      ]);
      grid.appendChild(winsItem);

      var totalItem = el('div', { className: 'score-item' }, [
        el('div', { className: 'score-value', textContent: String(stats.total) }),
        el('div', { className: 'score-label', textContent: 'Days' })
      ]);
      grid.appendChild(totalItem);

      var streakItem = el('div', { className: 'score-item' }, [
        el('div', { className: 'score-value', textContent: String(stats.streak) }),
        el('div', { className: 'score-label', textContent: 'Streak' })
      ]);
      grid.appendChild(streakItem);

      scoreCard.appendChild(grid);
      main.appendChild(scoreCard);
    }

    // Date
    main.appendChild(el('div', { className: 'date-display', textContent: formatDateLong(today) }));

    // Task checklist
    var taskStates = cfg.tasks.map(function (_, idx) {
      return existing && existing.completedTasks ? existing.completedTasks[idx] || false : false;
    });

    var taskList = el('div', { className: 'task-list' });

    cfg.tasks.forEach(function (task, idx) {
      var item = el('div', { className: 'task-item' + (taskStates[idx] ? ' checked' : '') });
      var check = el('div', { className: 'task-check', textContent: '\u2713' });
      check.style.background = taskStates[idx] ? color : 'transparent';
      check.style.borderColor = taskStates[idx] ? color : '';
      check.style.color = taskStates[idx] ? '#fff' : 'transparent';

      var text = el('div', { className: 'task-text', textContent: task });

      item.appendChild(check);
      item.appendChild(text);

      item.addEventListener('click', function () {
        taskStates[idx] = !taskStates[idx];
        item.classList.toggle('checked', taskStates[idx]);
        check.style.background = taskStates[idx] ? color : 'transparent';
        check.style.borderColor = taskStates[idx] ? color : '';
        check.style.color = taskStates[idx] ? '#fff' : 'transparent';
        updateProgressAndWin();
      });

      taskList.appendChild(item);
    });

    main.appendChild(taskList);

    // Progress bar
    var progressWrap = el('div', { className: 'progress-wrap' });
    var progressInfo = el('div', { className: 'progress-info' });
    var progressCount = el('span', { textContent: '' });
    progressInfo.appendChild(progressCount);
    progressWrap.appendChild(progressInfo);
    var progressTrack = el('div', { className: 'progress-bar-track' });
    var progressFill = el('div', { className: 'progress-bar-fill' });
    progressFill.style.background = color;
    progressTrack.appendChild(progressFill);
    progressWrap.appendChild(progressTrack);
    main.appendChild(progressWrap);

    // Win banner
    var winBanner = el('div', { className: 'win-banner' });
    main.appendChild(winBanner);

    function updateProgressAndWin() {
      var count = taskStates.filter(Boolean).length;
      var total = cfg.tasks.length;
      var pct = Math.round((count / total) * 100);
      progressCount.textContent = count + '/' + total + ' completed';
      progressFill.style.width = pct + '%';

      var winning = isWin(count, total);
      winBanner.className = 'win-banner ' + (winning ? 'winning' : 'not-yet');
      winBanner.textContent = winning
        ? '\uD83C\uDFC6 You\'re winning the day!'
        : 'Complete ' + (Math.min(4, total) - count) + ' more to win';
    }
    updateProgressAndWin();

    // Notes
    var notesLabel = el('div', { className: 'card-label', textContent: 'Notes', style: 'margin-top:8px' });
    main.appendChild(notesLabel);
    var notesArea = el('textarea', { className: 'notes-area', placeholder: 'Reflections, wins, lessons...' });
    notesArea.value = existing && existing.note ? existing.note : '';
    main.appendChild(notesArea);

    // Save button
    var saveBtn = el('button', {
      className: 'btn btn-primary',
      textContent: existing ? 'Update Entry \u2713' : 'Record Day \u2713',
      onClick: function () {
        var count = taskStates.filter(Boolean).length;
        var total = cfg.tasks.length;
        var entry = {
          date: today,
          completed: count,
          tasksTotal: total,
          completedTasks: taskStates.slice(),
          success: isWin(count, total),
          note: notesArea.value.trim(),
          timestamp: new Date().toISOString()
        };
        var idx = -1;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].date === today) { idx = i; break; }
        }
        if (idx >= 0) entries[idx] = entry; else entries.push(entry);
        saveEntries(cat, entries);

        if (entry.success) {
          celebrate();
          showToast('\uD83C\uDFC6 You won the day!');
        } else {
          showToast('Day recorded. Tomorrow\'s a new chance.');
        }
        setTimeout(function () { renderApp(); }, 400);
      }
    });
    main.appendChild(saveBtn);
  }

  /* ────────────────────────────────────────────────
     Setup View
  ──────────────────────────────────────────────── */
  function renderSetup(main) {
    var cat = state.currentCat;
    var cfg = getCfg(cat) || {};
    var catName = CAT_LABELS[cat];
    var color = CAT_COLORS[cat];
    var placeholders = PLACEHOLDERS[cat];

    var titleEl = el('div', { className: 'card-label', textContent: catName + ' Setup', style: 'font-size:18px;margin-bottom:4px;text-transform:none' });
    titleEl.style.color = color;
    main.appendChild(titleEl);
    main.appendChild(el('div', { style: 'font-size:14px;color:#94a3b8;margin-bottom:20px', textContent: 'Define your daily lead measures and goals' }));

    var card = el('div', { className: 'card' });

    // Start date
    var g1 = el('div', { className: 'form-group' });
    g1.appendChild(el('label', { className: 'form-label', textContent: 'Start Date' }));
    g1.appendChild(el('input', { className: 'form-input', type: 'date', id: 'setup-start', value: cfg.startDate || todayISO() }));
    card.appendChild(g1);

    // Length
    var g2 = el('div', { className: 'form-group' });
    g2.appendChild(el('label', { className: 'form-label', textContent: 'Program Length (days)' }));
    g2.appendChild(el('input', { className: 'form-input', type: 'number', id: 'setup-length', min: '28', max: '365', value: String(cfg.length || 112) }));
    card.appendChild(g2);

    // Reminder
    var g3 = el('div', { className: 'form-group' });
    g3.appendChild(el('label', { className: 'form-label', textContent: 'Daily Reminder Time' }));
    g3.appendChild(el('input', { className: 'form-input', type: 'time', id: 'setup-reminder', value: cfg.reminder || '08:00' }));
    card.appendChild(g3);

    // Lead Measures
    var measuresLabel = el('label', { className: 'form-label', textContent: 'Lead Measures (1-5)', style: 'margin-top:8px' });
    card.appendChild(measuresLabel);

    for (var i = 0; i < 5; i++) {
      var gm = el('div', { className: 'form-group', style: 'margin-bottom:8px' });
      gm.appendChild(el('input', {
        className: 'form-input',
        type: 'text',
        id: 'setup-task-' + i,
        placeholder: placeholders[i] || 'Lead measure ' + (i + 1),
        value: cfg.tasks && cfg.tasks[i] ? cfg.tasks[i] : ''
      }));
      card.appendChild(gm);
    }

    // Goals (collapsible)
    var goalsHeader = el('div', { className: 'collapsible-header' });
    var goalsTitle = el('div', { className: 'collapsible-title', textContent: 'Goals (optional)' });
    var goalsArrow = el('div', { className: 'collapsible-arrow', textContent: '\u25BC' });
    goalsHeader.appendChild(goalsTitle);
    goalsHeader.appendChild(goalsArrow);
    card.appendChild(goalsHeader);

    var goalsBody = el('div', { className: 'collapsible-body' });

    var gw = el('div', { className: 'form-group' });
    gw.appendChild(el('label', { className: 'form-label', textContent: 'Weekly Goal' }));
    gw.appendChild(el('input', { className: 'form-input', type: 'text', id: 'setup-weekly', placeholder: 'Optional weekly goal', value: cfg.weekly || '' }));
    goalsBody.appendChild(gw);

    var gmo = el('div', { className: 'form-group' });
    gmo.appendChild(el('label', { className: 'form-label', textContent: 'Monthly Goal' }));
    gmo.appendChild(el('input', { className: 'form-input', type: 'text', id: 'setup-monthly', placeholder: 'Optional monthly goal', value: cfg.monthly || '' }));
    goalsBody.appendChild(gmo);

    var ga = el('div', { className: 'form-group' });
    ga.appendChild(el('label', { className: 'form-label', textContent: 'Annual Goal' }));
    ga.appendChild(el('input', { className: 'form-input', type: 'text', id: 'setup-annual', placeholder: 'Optional annual goal', value: cfg.annual || '' }));
    goalsBody.appendChild(ga);

    card.appendChild(goalsBody);

    var goalsOpen = false;
    goalsHeader.addEventListener('click', function () {
      goalsOpen = !goalsOpen;
      goalsBody.classList.toggle('open', goalsOpen);
      goalsArrow.classList.toggle('open', goalsOpen);
    });

    main.appendChild(card);

    // Save button
    var saveBtn = el('button', {
      className: 'btn btn-primary',
      textContent: cfg.tasks && cfg.tasks.length ? 'Update Setup' : 'Save & Start',
      style: 'margin-bottom:12px',
      onClick: function () {
        var tasks = [];
        for (var j = 0; j < 5; j++) {
          var v = document.getElementById('setup-task-' + j).value.trim();
          if (v) tasks.push(v);
        }
        if (!tasks.length) {
          showToast('Add at least one lead measure');
          return;
        }
        var newCfg = {
          startDate: document.getElementById('setup-start').value,
          length: parseInt(document.getElementById('setup-length').value) || 112,
          reminder: document.getElementById('setup-reminder').value,
          tasks: tasks,
          weekly: document.getElementById('setup-weekly').value.trim(),
          monthly: document.getElementById('setup-monthly').value.trim(),
          annual: document.getElementById('setup-annual').value.trim()
        };
        saveCfg(cat, newCfg);
        showToast('Setup saved \u2713');
        state.currentSub = 'daily';
        renderApp();
      }
    });
    main.appendChild(saveBtn);

    // Reset button
    var resetBtn = el('button', {
      className: 'btn btn-danger',
      textContent: 'Reset ' + catName + ' Data',
      onClick: function () {
        showModal(
          'Reset ' + catName + '?',
          'This will permanently delete all ' + catName + ' configuration and entries. This cannot be undone.',
          'Reset',
          function () {
            localStorage.removeItem('wtd_cfg_' + cat);
            localStorage.removeItem('wtd_ent_' + cat);
            showToast(catName + ' data cleared');
            renderApp();
          }
        );
      }
    });
    main.appendChild(resetBtn);
  }

  /* ────────────────────────────────────────────────
     Progress View
  ──────────────────────────────────────────────── */
  function renderProgress(main) {
    var cat = state.currentCat;
    var catName = CAT_LABELS[cat];
    var color = CAT_COLORS[cat];
    var cfg = getCfg(cat);
    var entries = getEntries(cat).sort(function (a, b) { return b.date.localeCompare(a.date); });
    var stats = getStats(cat);

    var titleEl = el('div', { className: 'card-label', textContent: catName + ' Progress', style: 'font-size:18px;margin-bottom:16px;text-transform:none' });
    titleEl.style.color = color;
    main.appendChild(titleEl);

    if (!entries.length) {
      main.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-icon', textContent: '\uD83D\uDCCA' }),
        el('div', { className: 'empty-text', textContent: 'No entries recorded yet. Start tracking your daily lead measures!' })
      ]));
      return;
    }

    // Stats grid
    var statsGrid = el('div', { className: 'stats-grid' });

    var items = [
      { value: String(stats.total), label: 'Days' },
      { value: String(stats.wins), label: 'Wins' },
      { value: String(stats.losses), label: 'Losses' },
      { value: String(stats.rate) + '%', label: 'Win Rate' },
      { value: String(stats.streak), label: 'Streak' },
      { value: String(stats.bestStreak), label: 'Best' }
    ];
    items.forEach(function (item) {
      var sc = el('div', { className: 'stat-card' }, [
        el('div', { className: 'stat-value', textContent: item.value }),
        el('div', { className: 'stat-label', textContent: item.label })
      ]);
      statsGrid.appendChild(sc);
    });
    main.appendChild(statsGrid);

    // Win rate bar
    var wrCard = el('div', { className: 'wr-bar-card' });
    wrCard.appendChild(el('div', { className: 'wr-label', textContent: 'Overall Win Rate' }));
    var wrTrack = el('div', { className: 'wr-track' });
    var wrFill = el('div', { className: 'wr-fill' });
    wrFill.style.width = stats.rate + '%';
    wrFill.style.background = color;
    wrTrack.appendChild(wrFill);
    wrCard.appendChild(wrTrack);
    var wrPct = el('div', { className: 'wr-pct', textContent: stats.rate + '%' });
    wrPct.style.color = color;
    wrCard.appendChild(wrPct);
    main.appendChild(wrCard);

    // History
    var histCard = el('div', { className: 'card' });
    histCard.appendChild(el('div', { className: 'card-label', textContent: 'Day-by-Day History' }));

    entries.forEach(function (entry) {
      var row = el('div', { className: 'history-item' });
      row.appendChild(el('div', { className: 'history-dot ' + (entry.success ? 'win' : 'loss') }));
      row.appendChild(el('div', { className: 'history-date', textContent: formatDateShort(entry.date) }));
      var scoreEl = el('div', { className: 'history-score', textContent: entry.completed + '/' + entry.tasksTotal });
      scoreEl.style.color = entry.success ? color : '#ef4444';
      row.appendChild(scoreEl);
      row.appendChild(el('div', { className: 'history-note', textContent: entry.note || '\u2014' }));

      row.addEventListener('click', function () {
        if (state.expandedHistoryDate === entry.date) {
          state.expandedHistoryDate = null;
          renderApp();
        } else {
          state.expandedHistoryDate = entry.date;
          renderApp();
        }
      });

      histCard.appendChild(row);

      // Expanded view
      if (state.expandedHistoryDate === entry.date) {
        var expanded = el('div', { className: 'history-expanded' });
        expanded.appendChild(el('div', { textContent: formatDateLong(entry.date), style: 'font-weight:600;margin-bottom:6px' }));
        if (entry.note) {
          expanded.appendChild(el('div', { textContent: entry.note, style: 'margin-bottom:8px' }));
        }
        if (cfg && cfg.tasks && entry.completedTasks) {
          var tasksDiv = el('div', { className: 'history-expanded-tasks' });
          cfg.tasks.forEach(function (task, tIdx) {
            var done = entry.completedTasks[tIdx] || false;
            tasksDiv.appendChild(el('div', { className: 'history-task-row' }, [
              el('div', { className: 'history-task-check ' + (done ? 'done' : 'missed'), textContent: done ? '\u2713' : '\u2716' }),
              el('div', { textContent: task, style: done ? '' : 'color:#ef4444' })
            ]));
          });
          expanded.appendChild(tasksDiv);
        }
        histCard.appendChild(expanded);
      }
    });

    main.appendChild(histCard);

    // Export CSV
    var exportBtn = el('button', {
      className: 'btn btn-ghost',
      textContent: '\u2193 Export CSV',
      onClick: function () {
        var csv = 'date,completed,total,win,note\n';
        entries.forEach(function (entry) {
          csv += entry.date + ',' + entry.completed + ',' + entry.tasksTotal + ',' + (entry.success ? 'Yes' : 'No') + ',"' + (entry.note || '').replace(/"/g, '""') + '"\n';
        });
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = el('a', { href: url, download: cat + '-win-data.csv' });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('CSV downloaded');
      }
    });
    main.appendChild(exportBtn);
  }

  /* ────────────────────────────────────────────────
     Init
  ──────────────────────────────────────────────── */
  function init() {
    appEl = document.getElementById('app');
    if (!appEl) return;

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(function () {});
    }

    var appData = getAppData();
    if (appData.onboardingComplete) {
      renderApp();
    } else {
      renderOnboarding();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

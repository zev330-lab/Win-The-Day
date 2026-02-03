/*
 * Win The Day Tabs
 *
 * This application expands the original Win The Day concept across four
 * separate categories: personal, professional, home, and kids. Each
 * category maintains its own configuration (start date, program length,
 * reminder time, five daily lead measures and weekly/monthly/annual
 * goals) and its own daily entries and progress. Users can switch
 * categories using the top nav and switch between Daily, Setup, and
 * Progress subpages within each category.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Set copyright year
  document.getElementById('year').textContent = new Date().getFullYear();

  const app = document.getElementById('app');
  const categoryNav = document.getElementById('category-nav');
  const categoryButtons = Array.from(categoryNav.querySelectorAll('button'));

  // Define categories
  const categories = ['personal', 'professional', 'home', 'kids'];
  let currentCategory = categories[0];
  let currentSubPage = 'daily';

  // Helper: update active state on category buttons
  function updateCategoryNav() {
    categoryButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === currentCategory);
    });
  }

  // Category nav click events
  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      if (cat !== currentCategory) {
        currentCategory = cat;
        currentSubPage = 'daily';
      }
      updateCategoryNav();
      renderCategory();
    });
  });

  // Data helpers: get and set config/entries keyed by category
  function getConfig(cat) {
    try {
      return JSON.parse(localStorage.getItem(`winConfig_${cat}`) || 'null');
    } catch {
      return null;
    }
  }
  function saveConfig(cat, cfg) {
    localStorage.setItem(`winConfig_${cat}`, JSON.stringify(cfg));
  }
  function getEntries(cat) {
    try {
      return JSON.parse(localStorage.getItem(`winEntries_${cat}`) || '[]');
    } catch {
      return [];
    }
  }
  function saveEntries(cat, list) {
    localStorage.setItem(`winEntries_${cat}`, JSON.stringify(list));
  }

  /**
   * Notification scheduler for categories
   * Accepts a time (HH:MM), a title and body. Schedules a notification
   * each day at that time using setTimeout recursion. If the browser
   * does not support notifications or permission is denied, this
   * function silently fails.
   */
  async function scheduleDailyNotification(timeStr, title, body) {
    if (!('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    } catch {
      return;
    }
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('service-worker.js');
      } catch (e) {
        // ignore
      }
    }
    const [hours, minutes] = timeStr.split(':').map(n => parseInt(n, 10));
    function schedule() {
      const now = new Date();
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(now.getDate() + 1);
      const timeout = next.getTime() - now.getTime();
      setTimeout(() => {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'notify', title, body });
        } else {
          new Notification(title, { body });
        }
        schedule();
      }, timeout);
    }
    schedule();
  }

  // Listen for messages from service worker to show notifications directly
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'notify') {
        new Notification(event.data.title || 'Notification', { body: event.data.body || '' });
      }
    });
  }

  // Render the entire category page based on currentCategory and currentSubPage
  function renderCategory() {
    app.innerHTML = '';
    // Create subnav for the current category
    const subnav = document.createElement('div');
    subnav.className = 'subnav';
    const subPages = ['daily', 'setup', 'progress'];
    subPages.forEach(page => {
      const btn = document.createElement('button');
      btn.dataset.sub = page;
      btn.textContent = page.charAt(0).toUpperCase() + page.slice(1);
      if (page === currentSubPage) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentSubPage = page;
        renderCategory();
      });
      subnav.appendChild(btn);
    });
    // Section heading with category name
    const heading = document.createElement('h2');
    heading.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1) + ' — ' + currentSubPage.charAt(0).toUpperCase() + currentSubPage.slice(1);
    app.appendChild(heading);
    app.appendChild(subnav);
    // Call appropriate render function for subpage
    switch (currentSubPage) {
      case 'daily':
        renderDaily();
        break;
      case 'setup':
        renderSetup();
        break;
      case 'progress':
        renderProgress();
        break;
    }
  }

  // Render Daily page for current category
  function renderDaily() {
    const cfg = getConfig(currentCategory);
    if (!cfg) {
      // If no configuration, direct to Setup page
      const msg = document.createElement('p');
      msg.textContent = 'No configuration found for this category. Please set up your lead measures.';
      app.appendChild(msg);
      return;
    }
    // Determine today's date
    const today = new Date().toISOString().split('T')[0];
    const form = document.createElement('form');
    form.id = 'daily-form';
    // Add checkboxes for tasks
    cfg.tasks.forEach((task, idx) => {
      const label = document.createElement('label');
      label.className = 'task-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = `task${idx}`;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + task));
      form.appendChild(label);
    });
    // Force win option
    const forceLabel = document.createElement('label');
    const forceChk = document.createElement('input');
    forceChk.type = 'checkbox';
    forceChk.name = 'forceWin';
    forceLabel.appendChild(forceChk);
    forceLabel.appendChild(document.createTextNode(' Complete at least 4 tasks — count today as a win'));
    form.appendChild(forceLabel);
    // Notes field
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes/Reflection';
    const notesArea = document.createElement('textarea');
    notesArea.name = 'note';
    notesArea.placeholder = 'Optional notes or reflection...';
    notesLabel.appendChild(document.createElement('br'));
    notesLabel.appendChild(notesArea);
    form.appendChild(notesLabel);
    // Submit button
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'submit';
    submit.textContent = 'Record Day';
    form.appendChild(submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const completedCount = cfg.tasks.filter((_, i) => data.get(`task${i}`) !== null).length;
      const forceWin = data.get('forceWin') !== null;
      const success = completedCount === cfg.tasks.length || (forceWin && completedCount >= 4);
      const note = (data.get('note') || '').trim();
      // Save entry
      const entries = getEntries(currentCategory);
      const entry = {
        date: today,
        completed: completedCount,
        tasksTotal: cfg.tasks.length,
        success: success,
        note: note
      };
      const idx = entries.findIndex(e => e.date === today);
      if (idx >= 0) {
        entries[idx] = entry;
      } else {
        entries.push(entry);
      }
      saveEntries(currentCategory, entries);
      alert(success ? 'Great! You won the day.' : 'Day recorded. Try again tomorrow!');
      form.reset();
    });
    app.appendChild(form);
  }

  // Render Setup page for current category
  function renderSetup() {
    // Provide explanation
    const cfg = getConfig(currentCategory);
    const intro = document.createElement('p');
    intro.innerHTML = '<em>Define your lead measures for this category. Lead measures are daily actions within your control that drive your success. Choose up to five and optionally specify weekly, monthly, and annual goals.</em>';
    app.appendChild(intro);
    const form = document.createElement('form');
    form.id = 'setup-form';
    form.innerHTML = `
      <label>Start Date
        <input type="date" name="startDate" ${cfg && cfg.startDate ? `value="${cfg.startDate}"` : ''} required />
      </label>
      <label>Program Length (days, minimum 28)
        <input type="number" name="length" min="28" max="365" value="${cfg && cfg.length ? cfg.length : 112}" required />
      </label>
      <label>Daily Reminder Time
        <input type="time" name="reminder" ${cfg && cfg.reminder ? `value="${cfg.reminder}"` : ''} required />
      </label>
      <fieldset>
        <legend>Daily Lead Measures (up to 5)</legend>
        ${Array.from({ length: 5 }, (_, i) => {
          const value = cfg && cfg.tasks && cfg.tasks[i] ? cfg.tasks[i] : '';
          return `<input type="text" name="task${i}" placeholder="Task ${i + 1}" value="${value}" />`;
        }).join('')}
      </fieldset>
      <label>Weekly Lead Measure
        <input type="text" name="weekly" placeholder="Weekly goal" ${cfg && cfg.weekly ? `value="${cfg.weekly}"` : ''} />
      </label>
      <label>Monthly Lead Measure
        <input type="text" name="monthly" placeholder="Monthly goal" ${cfg && cfg.monthly ? `value="${cfg.monthly}"` : ''} />
      </label>
      <label>Annual Lead Measure
        <input type="text" name="annual" placeholder="Annual goal" ${cfg && cfg.annual ? `value="${cfg.annual}"` : ''} />
      </label>
      <button type="submit" class="submit">Save Configuration</button>
    `;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const config = {
        startDate: data.get('startDate'),
        length: parseInt(data.get('length'), 10),
        reminder: data.get('reminder'),
        tasks: Array.from({ length: 5 }, (_, i) => data.get(`task${i}`)).filter(t => t && t.trim().length > 0),
        weekly: (data.get('weekly') || '').trim(),
        monthly: (data.get('monthly') || '').trim(),
        annual: (data.get('annual') || '').trim()
      };
      saveConfig(currentCategory, config);
      saveEntries(currentCategory, []);
      // Schedule a daily notification for this category
      scheduleDailyNotification(config.reminder, `Win The Day — ${currentCategory}`, `Time to record your ${currentCategory} lead measures`);
      alert('Configuration saved successfully.');
      currentSubPage = 'daily';
      renderCategory();
    });
    app.appendChild(form);
  }

  // Render Progress page for current category
  function renderProgress() {
    const entries = getEntries(currentCategory);
    if (entries.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No entries recorded yet. Start by recording your day!';
      app.appendChild(p);
      return;
    }
    const totalDays = entries.length;
    const totalWins = entries.filter(e => e.success).length;
    const summary = document.createElement('p');
    summary.textContent = `You have recorded ${totalDays} day(s) and won ${totalWins} day(s) in this category.`;
    app.appendChild(summary);
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr><th>Date</th><th>Completed</th><th>Win</th><th>Notes</th></tr>
      </thead>
      <tbody>
        ${entries
          .map(e => `<tr><td>${e.date}</td><td>${e.completed}/${e.tasksTotal}</td><td>${e.success ? 'Yes' : 'No'}</td><td>${e.note.replace(/\n/g, '<br>')}</td></tr>`)
          .join('')}
      </tbody>
    `;
    app.appendChild(table);
    const exportBtn = document.createElement('button');
    exportBtn.className = 'submit';
    exportBtn.textContent = 'Export Data (CSV)';
    exportBtn.addEventListener('click', () => {
      const csvRows = [];
      csvRows.push('date,completed,tasksTotal,win,note');
      entries.forEach(e => {
        const row = [e.date, e.completed, e.tasksTotal, e.success ? 'Yes' : 'No', '"' + e.note.replace(/"/g, '""') + '"'];
        csvRows.push(row.join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentCategory}-win-data.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
    app.appendChild(exportBtn);
  }

  // On initial load, set category nav and render
  updateCategoryNav();
  renderCategory();
});
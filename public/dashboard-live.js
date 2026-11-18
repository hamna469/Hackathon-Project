(function () {
  const API = window.API_BASE;
  const $ = id => document.getElementById(id);

  const input = $('transcript-input');
  const btnCreate = $('btn-create-transcript');
  const btnClear = $('btn-clear-transcript');
  const loading = $('transcript-loading');
  const errBox = $('transcript-error');
  const errDesc = $('transcript-error-desc');
  const okBox = $('transcript-success');
  const okDesc = $('transcript-success-desc');
  const grid = $('projects-grid');
  const badge = $('projects-count-badge');
  const tSection = $('all-tasks-section');
  const tBody = $('all-tasks-table-body');
  const tCount = $('all-tasks-count-badge');
  const search = $('dashboard-project-search');

  let userNames = {};

  function showError(msg) {
    errDesc.textContent = msg;
    errBox.classList.remove('hidden');
    okBox.classList.add('hidden');
  }

  function showSuccess(msg) {
    okDesc.textContent = msg;
    okBox.classList.remove('hidden');
    errBox.classList.add('hidden');
  }

  function clearMessages() {
    errBox.classList.add('hidden');
    okBox.classList.add('hidden');
  }

  function initials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'NW';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function nameOf(id) {
    return userNames[id] || id;
  }

  async function loadUsers() {
    const res = await fetch(`${API}/api/users`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Team directory load nahi hui (Status: ${res.status})`);
    const list = await res.json();
    userNames = Object.fromEntries(list.map(u => [u.id, u.name]));
  }

  async function loadProjects() {
    grid.innerHTML = '<p class="text-outline">Projects load ho rahe hain...</p>';
    try {
      await loadUsers();
      const list = await apiGetProjects();
      const details = await Promise.all(list.map(p => apiGetProject(p.id)));
      render(details);
    } catch (err) {
      grid.innerHTML = '';
      showError(err.message || 'Projects load nahi ho sake.');
    }
  }

  function render(details) {
    badge.textContent = `${details.length} visible`;

    if (!details.length) {
      grid.innerHTML = '<p class="text-outline">Abhi koi project nahi hai. Upar transcript paste karke Create dabayein.</p>';
      tSection.classList.add('hidden');
      return;
    }

    grid.innerHTML = details.map(p => {
      const totalHours = p.tasks.reduce((s, t) => s + Number(t.estimatedHours || 0), 0);
      const taskRows = p.tasks.map(t => `
        <div class="flex items-center justify-between gap-2 p-1.5 rounded bg-surface-container-low/70 text-body-sm">
          <span class="truncate font-medium text-[12px] text-on-surface">${escapeHtml(t.title)}</span>
          <span class="text-[10px] px-1.5 rounded bg-surface-container text-outline truncate max-w-[90px]">${escapeHtml(nameOf(t.assigneeId))}</span>
        </div>`).join('') || '<p class="text-[11px] text-outline italic py-1">Is project ka koi task nahi.</p>';

      return `
        <div class="project-card bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow p-space-lg flex flex-col justify-between group border border-[#E2E8F0]">
          <div>
            <h3 class="font-headline-md text-headline-md text-on-surface tracking-tight">${escapeHtml(p.name)}</h3>
            <div class="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm mt-space-xs">
              <span class="material-symbols-outlined text-[16px] text-outline">apartment</span>
              <span>${escapeHtml(p.clientName)}</span>
            </div>
            <p class="font-body-sm text-body-sm text-outline mt-space-sm line-clamp-2">${escapeHtml(p.description || '')}</p>
            <div class="mt-space-md pt-space-sm border-t border-[#E2E8F0]">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-label-sm text-label-sm font-semibold text-on-surface">Tasks (${p.tasks.length})</span>
                <a href="project-detail.html" data-open-id="${escapeHtml(p.id)}" class="text-[11px] font-label-sm text-primary hover:underline">Open</a>
              </div>
              <div class="space-y-1 max-h-36 overflow-y-auto pr-1">${taskRows}</div>
            </div>
          </div>
          <div class="mt-space-lg pt-space-md border-t border-[#E2E8F0]">
            <div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span class="font-medium text-on-surface">${escapeHtml(nameOf(p.managerId))}</span>
              <span>Total: ${totalHours} hrs</span>
              <span>${escapeHtml(p.deadline)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    const rows = [];
    details.forEach(p => p.tasks.forEach(t => rows.push({ project: p, task: t })));

    tSection.classList.remove('hidden');
    tCount.textContent = `${rows.length} Deliverables`;
    tBody.innerHTML = rows.map(({ project, task }) => `
      <tr class="h-12 hover:bg-surface-container-low/60 transition-colors">
        <td class="px-space-md py-2 font-medium text-primary">
          <a href="project-detail.html" data-open-id="${escapeHtml(project.id)}" class="hover:underline">${escapeHtml(project.name)}</a>
        </td>
        <td class="px-space-md py-2 font-semibold text-on-surface">${escapeHtml(task.title)}</td>
        <td class="px-space-md py-2">
          <div class="flex items-center gap-1.5">
            <div class="w-6 h-6 rounded-full bg-primary-container text-on-primary text-[10px] flex items-center justify-center font-bold">${initials(nameOf(task.assigneeId))}</div>
            <span class="text-on-surface">${escapeHtml(nameOf(task.assigneeId))}</span>
          </div>
        </td>
        <td class="px-space-md py-2 text-on-surface-variant">${escapeHtml(task.deadline)}</td>
        <td class="px-space-md py-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-surface-container text-on-surface-variant font-semibold">Pending</span>
        </td>
        <td class="px-space-md py-2 text-right text-on-surface-variant">${escapeHtml(task.estimatedHours)} hrs</td>
      </tr>`).join('');
  }

  // Remember the clicked project so project-detail.html can open it
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-open-id]');
    if (link) localStorage.setItem('novaworks_selected_project_id', link.dataset.openId);
  });

  btnCreate.addEventListener('click', async () => {
    clearMessages();
    const transcript = input.value.trim();
    if (!transcript) {
      showError('Please upar transcript paste karein.');
      input.focus();
      return;
    }

    const originalHtml = btnCreate.innerHTML;
    btnCreate.disabled = true;
    btnCreate.classList.add('opacity-75', 'cursor-not-allowed');
    btnCreate.innerHTML = '<span>Generating...</span>';
    loading.classList.remove('hidden');

    try {
      const result = await apiCreateFromTranscript(transcript);
      showSuccess(`${result.projectsCreated} project(s) aur ${result.tasksCreated} task(s) save ho gaye.`);
      await loadProjects();
    } catch (err) {
      showError(err.message || 'Projects banane mein masla aaya.');
    } finally {
      loading.classList.add('hidden');
      btnCreate.disabled = false;
      btnCreate.classList.remove('opacity-75', 'cursor-not-allowed');
      btnCreate.innerHTML = originalHtml;
    }
  });

  btnClear.addEventListener('click', () => {
    input.value = '';
    clearMessages();
  });

  search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#projects-grid .project-card').forEach(card => {
      card.style.display = (!q || card.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
    });
  });

  // Sample text hata do, aur asli projects load karo
  input.value = '';
  loadProjects();
})();
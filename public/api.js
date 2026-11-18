/**
 * NovaWorks CRM - API Base Configuration & Client
 *
 * The backend API runs on API_BASE.
 * Put the base URL in this single place so it is easy to change.
 */
const API_BASE = 'http://localhost:3000';

window.API_BASE = API_BASE;

const NOVA_KEYS = {
  USER: 'novaworks_user',
  PROJECTS: 'novaworks_projects',
};

/**
 * Login with email and password.
 * Sends: { email, password }
 * Returns: { id, name, role }
 * The session cookie is stored by the browser (credentials: 'include').
 */
async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Login failed (Status: ${res.status})`);
  }

  localStorage.setItem(NOVA_KEYS.USER, JSON.stringify(data));
  return data;
}

/**
 * Create projects and tasks from a meeting transcript (ADMIN only).
 * Sends: { transcript }
 * Returns: { projectsCreated, tasksCreated }
 */
async function apiCreateFromTranscript(transcript) {
  const res = await fetch(`${API_BASE}/api/create-from-transcript`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to create from transcript (Status: ${res.status})`);
  }
  return data;
}

/**
 * Get projects visible to the logged-in user (role-based on the server).
 * Returns: [{ id, name, clientName, managerId, deadline }]
 */
async function apiGetProjects() {
  const res = await fetch(`${API_BASE}/api/projects`, { credentials: 'include' });

  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load projects (Status: ${res.status})`);
  }
  return data;
}

/**
 * Get one project with its tasks (404 if the user has no access).
 */
async function apiGetProject(id) {
  const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(id)}`, { credentials: 'include' });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load project (Status: ${res.status})`);
  }
  return data;
}

/**
 * Get the logged-in user from the session.
 */
async function apiGetMe() {
  const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
  if (!res.ok) throw new Error('Not logged in');
  return res.json();
}

/**
 * Log out on the server, clear local data, and return to the login page.
 */
async function logoutUser(e) {
  if (e && e.preventDefault) e.preventDefault();
  await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  localStorage.removeItem(NOVA_KEYS.USER);
  localStorage.removeItem(NOVA_KEYS.PROJECTS);
  window.location.href = 'login.html';
}

/**
 * Redirect URL based on role from the server (ADMIN, MANAGER, AGENT).
 */
function getRoleRedirectUrl(role) {
  const r = (role || '').toString().toUpperCase().trim();
  if (r === 'ADMIN') return 'dashboard.html';
  if (r === 'MANAGER') return 'manager.html';
  if (r === 'AGENT') return 'agent.html';
  return 'login.html';
}

/**
 * Show the logged-in user's name and role in the header.
 */
function initHeaderProfile() {
  try {
    const rawUser = localStorage.getItem(NOVA_KEYS.USER);
    if (!rawUser) return;
    const user = JSON.parse(rawUser);

    const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

    document.querySelectorAll('[data-user-name]').forEach(el => {
      if (user.name) el.textContent = `${user.name} (${cap(user.role)})`;
    });

    document.querySelectorAll('[data-user-role]').forEach(el => {
      if (user.role) el.textContent = `${cap(user.role)} Workspace`;
    });
  } catch (err) {
    console.warn('Could not sync user profile:', err);
  }
}

/**
 * HTML escape helper (use it for any data put into innerHTML).
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initHeaderProfile);
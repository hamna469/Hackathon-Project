const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const crypto = require('crypto');
const { openDb, save } = require('./db');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: 'novaworks-demo-secret',
  resave: false,
  saveUninitialized: false,
}));

// Serve the frontend HTML/JS/CSS files from the public folder
app.use(express.static('public'));

let db;

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

function currentUser(req) {
  const r = db.exec('SELECT id, name, role FROM users WHERE id = ?', [req.session.userId]);
  if (!r.length) return null;
  const [id, name, role] = r[0].values[0];
  return { id, name, role };
}

function rowsOf(sql, params = []) {
  const r = db.exec(sql, params);
  return r.length ? r[0].values : [];
}

const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const result = db.exec('SELECT * FROM users WHERE email = ?', [email]);
  if (!result.length) return res.status(401).json({ error: 'Invalid credentials' });

  const [id, name, , hash, role] = result[0].values[0];
  if (!bcrypt.compareSync(password, hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.userId = id;
  res.json({ id, name, role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  res.json(currentUser(req));
});

app.get('/api/users', requireLogin, (req, res) => {
  const rows = rowsOf('SELECT id, name, role, specialization FROM users ORDER BY id');
  res.json(rows.map(([id, name, role, specialization]) => ({ id, name, role, specialization })));
});

app.get('/api/projects', requireLogin, (req, res) => {
  const user = currentUser(req);
  let sql, params = [];

  if (user.role === 'ADMIN') {
    sql = 'SELECT id, name, client_name, manager_id, deadline FROM projects ORDER BY deadline';
  } else if (user.role === 'MANAGER') {
    sql = 'SELECT id, name, client_name, manager_id, deadline FROM projects WHERE manager_id = ? ORDER BY deadline';
    params = [user.id];
  } else {
    sql = `SELECT DISTINCT p.id, p.name, p.client_name, p.manager_id, p.deadline
           FROM projects p JOIN tasks t ON t.project_id = p.id
           WHERE t.assignee_id = ? ORDER BY p.deadline`;
    params = [user.id];
  }

  const rows = rowsOf(sql, params);
  res.json(rows.map(([id, name, client_name, manager_id, deadline]) =>
    ({ id, name, clientName: client_name, managerId: manager_id, deadline })));
});

app.get('/api/projects/:id', requireLogin, (req, res) => {
  const user = currentUser(req);
  const projectId = req.params.id;

  let allowed;
  if (user.role === 'ADMIN') {
    allowed = true;
  } else if (user.role === 'MANAGER') {
    allowed = rowsOf('SELECT 1 FROM projects WHERE id = ? AND manager_id = ?', [projectId, user.id]).length > 0;
  } else {
    allowed = rowsOf('SELECT 1 FROM tasks WHERE project_id = ? AND assignee_id = ? LIMIT 1', [projectId, user.id]).length > 0;
  }
  if (!allowed) return res.status(404).json({ error: 'Project not found' });

  const p = rowsOf('SELECT id, name, client_name, description, manager_id, deadline FROM projects WHERE id = ?', [projectId]);
  if (!p.length) return res.status(404).json({ error: 'Project not found' });
  const [id, name, client_name, description, manager_id, deadline] = p[0];

  let taskSql = 'SELECT id, title, description, assignee_id, deadline, estimated_hours FROM tasks WHERE project_id = ?';
  const taskParams = [projectId];
  if (user.role === 'AGENT') {
    taskSql += ' AND assignee_id = ?';
    taskParams.push(user.id);
  }
  const tasks = rowsOf(taskSql + ' ORDER BY deadline', taskParams)
    .map(([tid, title, tdesc, assignee_id, tdeadline, hours]) =>
      ({ id: tid, title, description: tdesc, assigneeId: assignee_id, deadline: tdeadline, estimatedHours: hours }));

  res.json({ id, name, clientName: client_name, description, managerId: manager_id, deadline, tasks });
});

async function callAI(transcript, dir) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');

  const directoryText = dir
    .map(u => `- ${u.id}: ${u.name} (${u.role}, skills: ${u.skills.join(', ')})`)
    .join('\n');

  const prompt = `You are a project management assistant. Read the meeting transcript below and extract every project and task.

TEAM DIRECTORY (use only these IDs):
${directoryText}

RULES:
- Create one project per client engagement discussed. Keep separate projects separate.
- managerId must be a MANAGER from the directory. assigneeId must be an AGENT from the directory.
- Do not invent people. If a named person is not in the directory, or is not an employee, do not assign them.
- Use the FINAL decisions stated in the transcript. If a value is revised or corrected later, use the revised value.
- Ignore features the transcript explicitly rejects or excludes. Do not create tasks for them.
- Each task needs a title, a short description, an assigneeId, a deadline (YYYY-MM-DD), and estimatedHours (a positive number of developer hours).
- Task deadlines must be on or before the project deadline.
- All dates are in 2026.

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY valid JSON, with no explanation and no markdown, in this exact shape:
{
  "projects": [
    {
      "name": "string",
      "clientName": "string",
      "description": "string",
      "managerId": "PM01",
      "deadline": "2026-10-20",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "assigneeId": "DEV01",
          "deadline": "2026-10-12",
          "estimatedHours": 12
        }
      ]
    }
  ]
}`;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'openrouter/free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });
  if (!resp.ok) throw new Error(`OpenRouter returned status ${resp.status}`);

  const data = await resp.json();
  const text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

function validateDraft(draft, dir) {
  const errs = [];
  const byId = Object.fromEntries(dir.map(u => [u.id, u]));

  if (!draft || !Array.isArray(draft.projects) || !draft.projects.length) {
    return ['AI output mein koi project nahi mila'];
  }

  draft.projects.forEach((p, i) => {
    const pl = `Project ${i + 1}`;
    if (!p.name) errs.push(`${pl}: name missing`);
    if (!p.clientName) errs.push(`${pl}: client missing`);
    if (!byId[p.managerId] || byId[p.managerId].role !== 'MANAGER') {
      errs.push(`${pl}: managerId "${p.managerId}" valid manager nahi hai`);
    }
    if (!isDate(p.deadline)) errs.push(`${pl}: deadline invalid (${p.deadline})`);
    if (!Array.isArray(p.tasks) || !p.tasks.length) errs.push(`${pl}: koi task nahi`);

    (p.tasks || []).forEach((t, j) => {
      const tl = `${pl}, task ${j + 1}`;
      if (!t.title) errs.push(`${tl}: title missing`);
      if (!byId[t.assigneeId] || byId[t.assigneeId].role !== 'AGENT') {
        errs.push(`${tl}: assigneeId "${t.assigneeId}" valid agent nahi hai`);
      }
      if (!(Number(t.estimatedHours) > 0)) errs.push(`${tl}: estimatedHours positive nahi`);
      if (!isDate(t.deadline)) errs.push(`${tl}: deadline invalid (${t.deadline})`);
      else if (isDate(p.deadline) && t.deadline > p.deadline) {
        errs.push(`${tl}: deadline project deadline se baad mein hai`);
      }
    });
  });
  return errs;
}

app.post('/api/create-from-transcript', requireLogin, async (req, res) => {
  const user = currentUser(req);
  if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admin can create from transcript' });

  const transcript = (req.body.transcript || '').trim();
  if (!transcript) return res.status(400).json({ error: 'Transcript is empty' });

  const dir = rowsOf('SELECT id, name, role, skills FROM users')
    .map(([id, name, role, skills]) => ({ id, name, role, skills: JSON.parse(skills) }));

  let draft;
  try {
    draft = await callAI(transcript, dir);
  } catch (e) {
    return res.status(502).json({ error: 'AI processing failed: ' + e.message });
  }

  const errors = validateDraft(draft, dir);
  if (errors.length) {
    return res.status(422).json({ error: 'Kuch fields theek nahi hain. Kuch save nahi hua.', details: errors });
  }

  db.run('BEGIN');
  try {
    let taskCount = 0;
    for (const p of draft.projects) {
      const projectId = 'PRJ-' + crypto.randomBytes(4).toString('hex');
      db.run(
        'INSERT INTO projects (id, name, client_name, description, manager_id, deadline) VALUES (?, ?, ?, ?, ?, ?)',
        [projectId, p.name, p.clientName, p.description || '', p.managerId, p.deadline]
      );
      for (const t of p.tasks) {
        const taskId = 'TSK-' + crypto.randomBytes(4).toString('hex');
        db.run(
          'INSERT INTO tasks (id, project_id, title, description, assignee_id, deadline, estimated_hours) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [taskId, projectId, t.title, t.description || '', t.assigneeId, t.deadline, Number(t.estimatedHours)]
        );
        taskCount++;
      }
    }
    db.run('COMMIT');
    save();
    res.json({ projectsCreated: draft.projects.length, tasksCreated: taskCount });
  } catch (e) {
    db.run('ROLLBACK');
    res.status(500).json({ error: 'Save failed, kuch bhi save nahi hua: ' + e.message });
  }
});

(async () => {
  db = await openDb();
  app.listen(3000, () => console.log('Server running on http://localhost:3000'));
})();
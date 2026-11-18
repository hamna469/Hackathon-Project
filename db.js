// db.js
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'crm.db');
let db = null;

async function openDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  const existing = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  db = existing ? new SQL.Database(existing) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL CHECK (role IN ('ADMIN','MANAGER','AGENT')),
      specialization TEXT,
      skills         TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      client_name TEXT NOT NULL,
      description TEXT,
      manager_id  TEXT NOT NULL REFERENCES users(id),
      deadline    TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      description     TEXT,
      assignee_id     TEXT NOT NULL REFERENCES users(id),
      deadline        TEXT NOT NULL,
      estimated_hours REAL NOT NULL CHECK (estimated_hours > 0)
    );
  `);

  save();
  return db;
}

// Database ko file mein save karta hai
function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

module.exports = { openDb, save };
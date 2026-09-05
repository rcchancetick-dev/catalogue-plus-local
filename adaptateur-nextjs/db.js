const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'catalogue-local.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE NOT NULL,
      titre TEXT NOT NULL,
      auteur TEXT NOT NULL,
      isbn TEXT,
      editeur TEXT,
      annee_publication INTEGER,
      categorie TEXT,
      langue TEXT DEFAULT 'Francais',
      nombre_pages INTEGER,
      description TEXT,
      couverture_url TEXT,
      emplacement TEXT,
      nombre_exemplaires INTEGER DEFAULT 1,
      exemplaires_disponibles INTEGER DEFAULT 1,
      statut TEXT DEFAULT 'disponible',
      qr_code_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      numero TEXT,
      email TEXT UNIQUE NOT NULL,
      etablissement TEXT,
      niveau TEXT,
      is_etudiant INTEGER DEFAULT 1,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      statut TEXT DEFAULT 'en_attente',
      duree_jours INTEGER DEFAULT 14,
      date_demande TEXT DEFAULT (datetime('now')),
      date_validation TEXT,
      date_emprunt TEXT,
      date_retour_prevue TEXT,
      date_retour_effective TEXT,
      motif_refus TEXT,
      valide_par INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL,
      recipient_id INTEGER NOT NULL,
      type TEXT,
      title TEXT,
      message TEXT,
      loan_id INTEGER,
      book_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_type TEXT NOT NULL,
      recipient_id INTEGER NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT,
      auth TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_action TEXT,
      description TEXT,
      admin_id INTEGER,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
initSchema();

function translateSqlForSqlite(text) {
  return text
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/::int/gi, '')
    .replace(/\bRETURNING \*/gi, '');
}

function buildQuery(strings, values) {
  let text = '';
  const params = [];
  strings.forEach((chunk, i) => {
    text += chunk;
    if (i < values.length) {
      text += '?';
      params.push(values[i]);
    }
  });
  return { text: translateSqlForSqlite(text), params };
}

async function sql(strings, ...values) {
  let rawText = '';
  strings.forEach((chunk, i) => {
    rawText += chunk;
    if (i < values.length) rawText += '?';
  });

  const { text, params } = buildQuery(strings, values);
  const trimmed = text.trim().toUpperCase();
  const wantsReturning = /RETURNING \*/i.test(rawText);

  if (trimmed.startsWith('SELECT')) {
    const stmt = db.prepare(text);
    return stmt.all(...params);
  }

  if (trimmed.startsWith('INSERT')) {
    const stmt = db.prepare(text);
    const info = stmt.run(...params);
    if (wantsReturning) {
      const match = rawText.match(/INSERT INTO (\w+)/i);
      const table = match ? match[1] : null;
      if (table) return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).all(info.lastInsertRowid);
    }
    return [];
  }

  if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
    const stmt = db.prepare(text);
    stmt.run(...params);
    return [];
  }

  const stmt = db.prepare(text);
  return stmt.all(...params);
}

module.exports = sql;
module.exports.sql = sql;
module.exports.default = sql;

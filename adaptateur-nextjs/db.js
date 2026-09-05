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
      overdue_notified INTEGER DEFAULT 0,
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

  const colonnesLoans = db.prepare("PRAGMA table_info(loans)").all().map(c => c.name);
  if (!colonnesLoans.includes('overdue_notified')) {
    db.exec('ALTER TABLE loans ADD COLUMN overdue_notified INTEGER DEFAULT 0');
  }
}
initSchema();

function translateSqlForSqlite(text) {
  text = text.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*months?'/gi, "datetime('now', '-$1 months')");
  text = text.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*days?'/gi, "datetime('now', '-$1 days')");
  text = text.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*years?'/gi, "datetime('now', '-$1 years')");
  text = text.replace(/NOW\(\)/gi, "datetime('now')");
  text = text.replace(/CURRENT_DATE/gi, "date('now')");
  text = text.replace(/TO_CHAR\(([\w.]+),\s*'YYYY-MM'\)/gi, "strftime('%Y-%m', $1)");
  text = text.replace(/TO_CHAR\(([\w.]+),\s*'YYYY-MM-DD'\)/gi, "strftime('%Y-%m-%d', $1)");
  text = text.replace(/::int/gi, '');
  text = text.replace(/\bRETURNING \*/gi, '');
  text = text.replace(/RETURNING [\w, ]+$/gi, '');
  return text;
}

function normalizeParam(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v;
}

function buildQuery(strings, values) {
  let text = '';
  const params = [];
  strings.forEach((chunk, i) => {
    text += chunk;
    if (i < values.length) {
      text += '?';
      params.push(normalizeParam(values[i]));
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
  const wantsReturning = /RETURNING\b/i.test(rawText);

  try {
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
  } catch (e) {
    console.error('[db.js local] Erreur SQL sur la requete traduite:');
    console.error('  Original :', rawText);
    console.error('  Traduite :', text);
    console.error('  Parametres:', params);
    console.error('  Erreur   :', e.message);
    throw e;
  }
}

module.exports = sql;
module.exports.sql = sql;
module.exports.default = sql;

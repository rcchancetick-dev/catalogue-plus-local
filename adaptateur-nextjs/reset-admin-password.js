/**
 * Script de reinitialisation du mot de passe admin (base locale SQLite)
 * Utilise exactement le meme algorithme que lib/auth.js (bcryptjs, cout 12)
 * Usage : node reset-admin-password.js email@exemple.com nouveauMotDePasse
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

async function main() {
  const [, , email, nouveauMotDePasse] = process.argv;

  if (!email || !nouveauMotDePasse) {
    console.error('Usage : node reset-admin-password.js email@exemple.com nouveauMotDePasse');
    process.exit(1);
  }
  if (nouveauMotDePasse.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caracteres.');
    process.exit(1);
  }

  const dbPath = path.join(process.cwd(), 'catalogue-local.db');
  const db = new Database(dbPath);

  const admin = db.prepare('SELECT id, nom, prenom, email FROM admins WHERE email = ?').get(email.toLowerCase().trim());
  if (!admin) {
    console.error(`Aucun administrateur trouve avec l'email : ${email}`);
    const tous = db.prepare('SELECT id, email FROM admins').all();
    console.error('Admins existants dans cette base locale :', tous);
    process.exit(1);
  }

  const hash = await bcrypt.hash(nouveauMotDePasse, 12);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);

  console.log(`Mot de passe reinitialise pour ${admin.prenom} ${admin.nom} (${admin.email}).`);
  console.log('Tu peux maintenant te connecter avec ce nouveau mot de passe sur /admin/login.');
}

main().catch((e) => {
  console.error('Erreur :', e.message);
  process.exit(1);
});

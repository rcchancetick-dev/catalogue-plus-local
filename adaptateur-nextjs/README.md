# Catalogue+ en local (meme interface que le site en ligne)

Ce dossier contient un adaptateur qui permet de faire tourner **le vrai code
Next.js de Catalogue+** directement sur ton PC, sans connexion Internet, en
remplacant la base Postgres (Neon/Vercel) par une base SQLite locale.

Resultat : l'interface est **identique a 100%** au site en ligne (memes pages,
memes styles, memes fonctionnalites : QR codes, emprunts, validation admin,
notifications). Seul l'endroit ou les donnees sont stockees change.

## Etape 1 : copier ce fichier dans ton projet

Copie le fichier `db.js` fourni ici et remplace le contenu de
`lib/db.js` dans ton projet `catalogue-plus` (le vrai, celui deploye sur
Vercel) UNIQUEMENT sur ton PC local. Ne pousse pas ce remplacement sur
GitHub/Vercel, sinon le site en ligne cessera d'utiliser Postgres.

Astuce recommandee : cree une copie separee de tout le dossier
`catalogue-plus` sur ton PC (ex: `catalogue-plus-offline`), et applique le
remplacement uniquement dans cette copie. Le dossier original connecte a
Vercel reste intact.

## Etape 2 : installer la dependance manquante

Dans le dossier de ta copie locale, lance :
```
npm install better-sqlite3
```

## Etape 3 : lancer le site en local

```
npm run dev
```

Le site s'ouvre sur `http://localhost:3000`, avec l'interface exacte du site
en ligne. Une base `catalogue-local.db` (fichier SQLite) est creee
automatiquement au premier lancement, avec les tables vides.

## Etape 4 : creer le premier compte administrateur

Va sur `http://localhost:3000` et utilise la page de configuration initiale
(`/admin/setup` ou equivalent selon tes pages) avec le code de configuration
defini dans `ADMIN_SETUP_CODE` (par defaut `ESPA-2A-2026-INIT`), exactement
comme sur le site en ligne.

## Etape 5 : rendre accessible aux telephones sur le meme wifi

Lance plutot :
```
npm run dev -- -H 0.0.0.0
```
Puis trouve l'adresse IP de ton PC (`ipconfig` sous Windows) et donne cette
adresse aux telephones connectes au meme wifi, suivie de `:3000`.
Exemple : `http://192.168.1.42:3000`

## Limites de cet adaptateur

- Compatible avec toutes les requetes SQL presentes dans le code actuel de
  Catalogue+ (SELECT, INSERT avec RETURNING, UPDATE, DELETE, ON CONFLICT).
- Les fonctionnalites de notifications push systeme (barre de notification du
  telephone) ne fonctionneront pas en local sans connexion Internet, car elles
  dependent des serveurs Google/Apple pour la livraison. Les notifications
  internes au site (cloche) fonctionnent normalement.
- Cette version locale est totalement independante de la base Postgres en
  ligne : aucune synchronisation automatique entre les deux.

# ⚠️ Projet abandonne

Ce depot (reecriture en Flask/Python) n'est **plus maintenu** et ne doit plus etre utilise.

## Ou trouver la version officielle du mode local ?

La version officielle et maintenue du mode hors ligne de Catalogue+ se trouve dans le depot **[rcchancetick-dev/catalogue-plus](https://github.com/rcchancetick-dev/catalogue-plus)**, dans le dossier `offline-server/`.

Ce mode reutilise directement l'interface Next.js du site principal (dossier `pages/`, notamment `pages/admin/dashboard.js`) et remplace uniquement la base de donnees distante (Neon Postgres) par une base locale SQLite, via la meme couche `lib/db.js`.

Toute modification, correction ou amelioration du mode local doit desormais se faire exclusivement dans `catalogue-plus`, jamais ici.

## Pourquoi ce depot a ete abandonne

Ce depot etait un essai parallele (reecriture complete en Python/Flask avec templates Jinja2) qui a fini par diverger de la version officielle. Pour eviter la confusion et la duplication de maintenance, tout le developpement se concentre desormais sur un seul projet : `catalogue-plus`.

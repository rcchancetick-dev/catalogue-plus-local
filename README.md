# Catalogue+ Local (mode hors ligne)

Ce mini-serveur Flask permet de faire fonctionner Catalogue+ **sans connexion Internet**,
en le faisant tourner directement sur un PC connecte au meme wifi local que les etudiants.

## 1. Installer Python (si pas deja fait)

Verifie que Python est installe :
```
python --version
```
Si ce n'est pas le cas, installe Python 3.10+ depuis python.org.

## 2. Installer les dependances

Ouvre un terminal dans ce dossier et lance :
```
pip install -r requirements.txt
```

## 3. Lancer le serveur

```
python app.py
```

Tu dois voir s'afficher :
```
Serveur local demarre.
Sur ce PC : http://127.0.0.1:5000
Depuis un telephone sur le meme wifi : http://<IP-DE-CE-PC>:5000
```

Une base de donnees `catalogue.db` est creee automatiquement au premier lancement,
avec 5 livres d'exemple deja inseres.

## 4. Trouver l'adresse IP de ce PC (pour que les telephones s'y connectent)

- **Windows** : ouvre l'invite de commandes et tape `ipconfig`, cherche "Adresse IPv4"
  (souvent du type `192.168.1.XX`).
- **Mac/Linux** : ouvre un terminal et tape `ifconfig` ou `ip addr`, cherche "inet" sous
  ton interface wifi.

## 5. Se connecter depuis un telephone

1. Connecte le telephone au **meme reseau wifi** que le PC (un routeur local suffit,
   pas besoin d'acces Internet).
2. Ouvre le navigateur du telephone et tape l'adresse trouvee a l'etape 4, suivie de
   `:5000`. Exemple : `http://192.168.1.42:5000`.

## Fonctionnalites incluses

- Consultation du catalogue avec recherche par titre/auteur.
- Emprunt d'un livre (14 jours par defaut, modifiable dans `app.py` via `DUREE_EMPRUNT_JOURS`).
- Un livre deja emprunte devient automatiquement indisponible pour les autres.
- Page "Emprunts en cours" pour voir qui a emprunte quoi et marquer un retour.

## Important pour la demo

Le serveur doit rester **allume et lance** (fenetre du terminal ouverte) pendant toute
la duree ou tu veux que le site soit accessible. Si tu fermes le terminal ou eteins le
PC, le site devient inaccessible pour tout le monde jusqu'au prochain lancement.

## Limite assumee

Cette version est **independante** de la vraie version en ligne (Vercel/Postgres).
Les emprunts faits ici ne se synchronisent pas automatiquement avec le site en ligne.
C'est un choix simple et fiable pour un mini-projet : pas de risque de conflit de
donnees entre les deux versions.

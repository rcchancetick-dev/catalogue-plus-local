import sqlite3
import os
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for, flash, g, Response

app = Flask(__name__)
app.secret_key = "change-cette-cle-avant-la-demo"
DB_PATH = os.path.join(os.path.dirname(__file__), "catalogue.db")
DUREE_EMPRUNT_JOURS = 14


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS livres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titre TEXT NOT NULL,
            auteur TEXT NOT NULL,
            categorie TEXT,
            disponible INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS emprunts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            livre_id INTEGER NOT NULL,
            emprunteur TEXT NOT NULL,
            date_emprunt TEXT NOT NULL,
            date_retour_prevue TEXT NOT NULL,
            date_retour_effective TEXT,
            FOREIGN KEY (livre_id) REFERENCES livres(id)
        );

        CREATE TABLE IF NOT EXISTS liste_attente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            livre_id INTEGER NOT NULL,
            demandeur TEXT NOT NULL,
            date_demande TEXT NOT NULL,
            notifie INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (livre_id) REFERENCES livres(id)
        );
        """
    )
    cur = db.execute("SELECT COUNT(*) FROM livres")
    if cur.fetchone()[0] == 0:
        db.executemany(
            "INSERT INTO livres (titre, auteur, categorie, disponible) VALUES (?, ?, ?, 1)",
            [
                ("Introduction a l'Algorithmique", "Cormen", "Informatique"),
                ("Reseaux Informatiques", "Tanenbaum", "Informatique"),
                ("Physique Generale", "Halliday", "Sciences"),
                ("Analyse Mathematique", "Rudin", "Mathematiques"),
                ("Bases de Donnees", "Elmasri", "Informatique"),
            ],
        )
        db.commit()
    db.close()


@app.route("/")
def index():
    db = get_db()
    q = request.args.get("q", "").strip()
    if q:
        livres = db.execute(
            "SELECT * FROM livres WHERE titre LIKE ? OR auteur LIKE ? ORDER BY titre",
            (f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        livres = db.execute("SELECT * FROM livres ORDER BY titre").fetchall()

    livres_avec_attente = []
    for livre in livres:
        nb_attente = db.execute(
            "SELECT COUNT(*) FROM liste_attente WHERE livre_id = ?", (livre["id"],)
        ).fetchone()[0]
        livres_avec_attente.append({**dict(livre), "nb_attente": nb_attente})

    return render_template("index.html", livres=livres_avec_attente, q=q)


@app.route("/emprunter/<int:livre_id>", methods=["GET", "POST"])
def emprunter(livre_id):
    db = get_db()
    livre = db.execute("SELECT * FROM livres WHERE id = ?", (livre_id,)).fetchone()
    if livre is None:
        flash("Livre introuvable.", "error")
        return redirect(url_for("index"))
    if not livre["disponible"]:
        flash("Ce livre n'est plus disponible. Inscrivez-vous sur la liste d'attente depuis le catalogue.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        emprunteur = request.form.get("emprunteur", "").strip()
        if not emprunteur:
            flash("Merci d'indiquer votre nom.", "error")
            return render_template("emprunter.html", livre=livre)

        maintenant = datetime.now()
        retour_prevu = maintenant + timedelta(days=DUREE_EMPRUNT_JOURS)
        db.execute(
            "INSERT INTO emprunts (livre_id, emprunteur, date_emprunt, date_retour_prevue) VALUES (?, ?, ?, ?)",
            (livre_id, emprunteur, maintenant.isoformat(), retour_prevu.isoformat()),
        )
        db.execute("UPDATE livres SET disponible = 0 WHERE id = ?", (livre_id,))
        db.commit()
        flash(f"Emprunt confirme ! A rendre avant le {retour_prevu.strftime('%d/%m/%Y')}.", "success")
        return redirect(url_for("index"))

    return render_template("emprunter.html", livre=livre)


@app.route("/liste-attente/<int:livre_id>", methods=["POST"])
def rejoindre_liste_attente(livre_id):
    db = get_db()
    livre = db.execute("SELECT * FROM livres WHERE id = ?", (livre_id,)).fetchone()
    if livre is None:
        flash("Livre introuvable.", "error")
        return redirect(url_for("index"))

    demandeur = request.form.get("demandeur", "").strip()
    if not demandeur:
        flash("Merci d'indiquer votre nom pour rejoindre la liste d'attente.", "error")
        return redirect(url_for("index"))

    deja_inscrit = db.execute(
        "SELECT id FROM liste_attente WHERE livre_id = ? AND demandeur = ?",
        (livre_id, demandeur),
    ).fetchone()
    if deja_inscrit:
        flash("Vous etes deja sur la liste d'attente pour ce livre.", "error")
        return redirect(url_for("index"))

    db.execute(
        "INSERT INTO liste_attente (livre_id, demandeur, date_demande) VALUES (?, ?, ?)",
        (livre_id, demandeur, datetime.now().isoformat()),
    )
    db.commit()
    position = db.execute(
        "SELECT COUNT(*) FROM liste_attente WHERE livre_id = ?", (livre_id,)
    ).fetchone()[0]
    flash(f"Inscrit sur la liste d'attente pour '{livre['titre']}' (position {position}).", "success")
    return redirect(url_for("index"))


@app.route("/retourner/<int:emprunt_id>", methods=["POST"])
def retourner(emprunt_id):
    db = get_db()
    emprunt = db.execute("SELECT * FROM emprunts WHERE id = ?", (emprunt_id,)).fetchone()
    if emprunt is None:
        flash("Emprunt introuvable.", "error")
        return redirect(url_for("emprunts"))

    db.execute(
        "UPDATE emprunts SET date_retour_effective = ? WHERE id = ?",
        (datetime.now().isoformat(), emprunt_id),
    )
    db.execute("UPDATE livres SET disponible = 1 WHERE id = ?", (emprunt["livre_id"],))
    db.commit()

    prochain = db.execute(
        "SELECT * FROM liste_attente WHERE livre_id = ? ORDER BY date_demande LIMIT 1",
        (emprunt["livre_id"],),
    ).fetchone()
    if prochain:
        flash(
            f"Livre rendu ! {prochain['demandeur']} est en tete de la liste d'attente pour ce livre.",
            "success",
        )
    else:
        flash("Livre rendu, merci !", "success")
    return redirect(url_for("emprunts"))


@app.route("/liste-attente/retirer/<int:attente_id>", methods=["POST"])
def retirer_liste_attente(attente_id):
    db = get_db()
    db.execute("DELETE FROM liste_attente WHERE id = ?", (attente_id,))
    db.commit()
    flash("Retire de la liste d'attente.", "success")
    return redirect(url_for("emprunts"))


@app.route("/emprunts")
def emprunts():
    db = get_db()
    en_cours = db.execute(
        """
        SELECT emprunts.id, livres.titre, livres.auteur, emprunts.emprunteur,
               emprunts.date_emprunt, emprunts.date_retour_prevue
        FROM emprunts
        JOIN livres ON livres.id = emprunts.livre_id
        WHERE emprunts.date_retour_effective IS NULL
        ORDER BY emprunts.date_retour_prevue
        """
    ).fetchall()

    attente = db.execute(
        """
        SELECT liste_attente.id, livres.titre, liste_attente.demandeur, liste_attente.date_demande
        FROM liste_attente
        JOIN livres ON livres.id = liste_attente.livre_id
        ORDER BY livres.titre, liste_attente.date_demande
        """
    ).fetchall()

    return render_template("emprunts.html", emprunts=en_cours, attente=attente)


@app.route("/export/emprunts.csv")
def export_emprunts_csv():
    db = get_db()
    lignes = db.execute(
        """
        SELECT livres.titre, livres.auteur, emprunts.emprunteur,
               emprunts.date_emprunt, emprunts.date_retour_prevue, emprunts.date_retour_effective
        FROM emprunts
        JOIN livres ON livres.id = emprunts.livre_id
        ORDER BY emprunts.date_emprunt DESC
        """
    ).fetchall()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Titre", "Auteur", "Emprunteur", "Date emprunt", "Date retour prevue", "Date retour effective", "Statut"])
    for l in lignes:
        statut = "Rendu" if l["date_retour_effective"] else "En cours"
        writer.writerow([
            l["titre"], l["auteur"], l["emprunteur"],
            l["date_emprunt"][:16].replace("T", " "),
            l["date_retour_prevue"][:10],
            l["date_retour_effective"][:16].replace("T", " ") if l["date_retour_effective"] else "",
            statut,
        ])

    return Response(
        buffer.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=emprunts_catalogue_plus.csv"},
    )


if __name__ == "__main__":
    init_db()
    print("Serveur local demarre.")
    print("Sur ce PC : http://127.0.0.1:5000")
    print("Depuis un telephone sur le meme wifi : http://<IP-DE-CE-PC>:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)

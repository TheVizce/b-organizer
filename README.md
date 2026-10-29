# Babe Organizer

Eigenes Verwaltungs-Tool für Profile von babepedia.com – läuft komplett im Browser auf GitHub Pages.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html`, `style.css`, `app.js` | Das Tool (kommt ins GitHub-Repo) |
| `babepedia-organizer.user.js` | Tampermonkey-Skript (Version 13, basiert auf deinem Skript 12.2) |

## Einrichten

### 1. Repo und GitHub Pages
1. Auf github.com ein neues Repository anlegen, z. B. `babe-organizer` (öffentlich – GitHub Pages ist bei kostenlosen Konten nur für öffentliche Repos verfügbar).
2. `index.html`, `style.css` und `app.js` hochladen (*Add file → Upload files*). Das Userscript und diese README können mit rein, müssen aber nicht.
3. *Settings → Pages → Branch: `main` / Ordner `/ (root)` → Save*.
4. Nach ca. einer Minute ist das Tool erreichbar unter `https://DEIN-NAME.github.io/babe-organizer/`.

> Hinweis: Die Seite ist öffentlich aufrufbar, deine **Daten aber nicht** – die liegen nur im localStorage deines Browsers. Die Seite ist per `noindex` von Suchmaschinen ausgeschlossen.

### 2. Userscript
1. In Tampermonkey das alte Skript (12.2) deaktivieren.
2. `babepedia-organizer.user.js` als neues Skript einfügen.
3. Oben im Skript `TOOL_URL` auf deine Adresse aus Schritt 1.4 setzen.
4. Beim ersten Öffnen des Tools fragt Tampermonkey evtl. nach Erlaubnis – zulassen.

Ein alter Batch aus Version 12.2 wird automatisch übernommen.

## Benutzung

- **➕ Add** auf einer Profilseite oder **🚀 Auto Fetch All** auf einer Listenseite sammelt Profile wie bisher (inkl. Listen verschieben).
- **🗂️ Tool öffnen** öffnet das Tool – alle gesammelten Profile werden automatisch übernommen und der Batch geleert.
- Vorhandene Einträge werden über die Profil-URL erkannt und aktualisiert; die eigenen Felder **Favorite, My Rating, Tags, Notes** bleiben erhalten.
- Im Tool: **＋ Neuer Eintrag** legt eigene Einträge an, ein Klick auf eine Karte öffnet die Details mit *Bearbeiten* / *Löschen*.
- **Meine Bewertung**: in der Detailansicht direkt per Klick (1–10) vergeben. Sie wird mit deinem **User Rating** auf Babepedia verglichen (✓ gleich / Abweichung). Filter „Bewertung“ und Sortierung „Größte Abweichung“ helfen beim Abgleich.
- **Daten → Importieren** liest CSV-Dateien des alten Skripts oder JSON-Backups (auch per Drag & Drop).
- **Daten → Backup exportieren** sichert alles als JSON – regelmäßig machen, und für den Umzug auf ein anderes Gerät nutzen.
- **Daten → Als CSV exportieren** erzeugt eine CSV im bisherigen Notion-Format (plus eigene Felder).

## Änderungen am Userscript gegenüber 12.2
- Batch liegt jetzt im Tampermonkey-Speicher statt im localStorage von babepedia (nötig, damit das Tool ihn lesen kann).
- Neuer Button **🗂️ Tool öffnen** und automatische Übertragung auf der Tool-Seite.
- Listen-Logik richtet sich nach der Seite, auf der du bist (Anzeige über den Buttons):
  - **NEU-Liste** (ID 204346): geholte Profile werden nach GELISTET verschoben.
  - **GELISTET-Liste** (ID 157076): Profile werden nur geholt, die Listen bleiben unverändert.
  - **Profilseite** (➕ Add): Profil wird in GELISTET aufgenommen und aus NEU entfernt.
  - **Andere Seite**: Das Skript fragt nach.
- `LIST_AUCH_GELISTET` entfernt (war nicht definiert und ließ **🔄 Move Lists Only** abbrechen).

## Änderungen in 13.2
- User-Upload-Bilder werden jetzt erfasst (sie werden auf Babepedia erst beim Scrollen geladen und fehlten deshalb).
- Mehrseitige Listen: Seitenzahl kommt direkt aus der Paginierung, auch Seite 1 wird geholt, wenn du auf einer späteren Seite startest. Fehlgeschlagene Seiten werden ein zweites Mal versucht, und am Ende gibt es einen Abgleich mit „Total number of babes in this list“.
- Mehr Pausen und Wiederholungen bei „zu vielen Anfragen“ (HTTP 429/503).
- Flaggen für alle 241 Nationality-Werte von Babepedia (aus der erweiterten Suche) plus gängige Schreibvarianten.
- Doppelte Profile werden über die Profil-URL statt über den Namen erkannt.

## Änderungen in 13.4
- Neues Feld **Profession Category**: fasst die Professions zu 12 Bereichen zusammen (mehrere pro Person möglich). Das Tool berechnet es automatisch, auch für bereits importierte und selbst angelegte Einträge. Das Skript schreibt es zusätzlich in den CSV-Export.
- Unbekannte Professions werden über Wortregeln zugeordnet (z. B. alles mit „Sportswoman“ → Athletics & Sports, „… Model“ → Modeling), sonst „Sonstige“.
- Die Zuordnung steht im Code ganz oben in `PROFESSION_CATEGORIES` (in `app.js` und im Userscript) und lässt sich dort leicht anpassen.

## Änderungen in 13.5
- Profile, die beim Auto Fetch nicht geholt werden konnten, werden gespeichert. Der Button **↻ Fehlgeschlagene (n)** holt sie erneut (Shift+Klick zeigt die Liste in der Konsole bzw. leert sie).
- Seiten ohne Profil (z. B. Bot-Schutz oder abgelaufener Login) zählen jetzt als Fehler statt stillschweigend zu fehlen.

## Änderungen in 13.6
- Verschieben NEU → GELISTET ist jetzt abgesichert: Das Skript wertet die Antwort von Babepedia aus (`success: true`). Nur wenn das Hinzufügen zu GELISTET bestätigt ist, wird aus NEU entfernt. „Schon in GELISTET“ gilt als Erfolg.
- Schlägt das Verschieben fehl (z. B. ausgeloggt), bleibt das Profil in NEU und landet bei **↻ Fehlgeschlagene**. Bei **➕ Add** erscheint eine Meldung.

## Änderungen in 13.7 (Tool)
- Daten liegen jetzt in **IndexedDB** statt im localStorage. Der localStorage hat nur ca. 5 MB und wird von allen Seiten unter `deinname.github.io` gemeinsam genutzt – bei ~3700 Profilen war er voll („The quota has been exceeded“), auch für die anderen Tools.
- Alte Daten werden beim ersten Öffnen automatisch übernommen und danach aus dem localStorage entfernt.
- Die Übernahme vom Userscript wird erst bestätigt, wenn wirklich gespeichert wurde. Schlägt das Speichern fehl, bleiben die Profile im Userscript.
- Änderungen erscheinen sofort auch in anderen offenen Tabs des Tools.
- Unter *Daten → Anleitung* steht, wie viel Speicher belegt ist.

## Änderungen in 13.7 (Skript) / Tool
- Neues Attribut **In Ranker** (Image-Ranker = Babepedia-Liste „Ranker“, ID 172740).
- Abgleich: Ranker-Liste öffnen (nach Name sortiert) → **🏆 Ranker-Abgleich** → **🗂️ Tool öffnen**. Das Tool setzt „In Ranker“ für alle Einträge (ja/nein) und zeigt, welche Ranker-Profile im Tool fehlen.
- Filter „Ranker“, 🏆-Abzeichen auf der Karte, Chip in der Detailansicht, Spalte in der Tabelle.
- Den Abgleich einfach wiederholen, wenn sich die Ranker-Liste geändert hat.

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
- Flaggen für rund 170 Nationalitäten.
- Doppelte Profile werden über die Profil-URL statt über den Namen erkannt.

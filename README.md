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
**Installieren / aktualisieren:** [babepedia-organizer.user.js](https://raw.githubusercontent.com/TheVizce/b-organizer/main/babepedia-organizer.user.js) öffnen – Tampermonkey bietet die Installation an. Danach prüft Tampermonkey selbst auf neue Versionen.

Manuell:
1. In Tampermonkey das alte Skript (12.2) deaktivieren.
2. `babepedia-organizer.user.js` als neues Skript einfügen.
3. `TOOL_URL` ist bereits auf `https://thevizce.github.io/b-organizer/` gesetzt.
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

## An Image Ranker senden
- **🏆 An Ranker** in der Detailansicht (ein Eintrag) oder in der Werkzeugleiste (alle gerade angezeigten Einträge).
- Im Dialog: **Reiter** im Ranker wählen (oder neu anlegen), **Bild** wählen (bei mehreren Einträgen: Titelbild, Antippen wechselt zum nächsten), **Eigenschaften** ankreuzen, die im Ranker angelegt werden (exakt / mehrfach / Zahl, Name änderbar). Reiter und Auswahl werden gemerkt.
- **Abgleich prüfen (Schritt 2):** Vor dem Senden vergleicht der Babe Organizer die Einträge mit den Bildern des Reiters (nur lesend):
  - *Automatisch* – genau ein Ranker-Bild hat denselben Babepedia-Profil-Link → wird verknüpft.
  - *Bitte prüfen* – nur der Name passt oder mehrere Bilder haben denselben Link → **keine Vorauswahl**, du tippst das richtige Bild an (sonst übersprungen).
  - *Kein Treffer* – von Hand suchen (Name, mit Vorschaubildern), überspringen oder neu anlegen.
  - *Bereits verknüpft* – wird nur aktualisiert.
- **Geburtsjahr:** eigene Eigenschaft, die nur die Jahreszahl aus „Born“ übernimmt (als Zahl).
- **Direktlink:** `/b-organizer/#e=<id>` öffnet einen Eintrag; der Image Ranker setzt diesen Link (Symbol „BO“) an jedes verknüpfte Bild.
- **Anderes Bild für den Ranker wählen:** Im Image Ranker in der Detailansicht „🖼️ Anderes Bild wählen“ → der Eintrag öffnet sich hier mit einer Hinweisleiste und dem Knopf „✔ Dieses Bild nehmen“ unter jedem Bild. Der Ranker tauscht nur das Bild, Elo, Duelle und Eigenschaften bleiben. (Babepedia-Bilder brauchen dafür das Userscript, sonst kommt nur ein Link an.)
- **Nur verknüpfen:** Häkchen in Schritt 1 – es werden keine neuen Bilder angelegt.
- Zusätzliche Sicherung im Ranker: Ein Bild mit demselben Profil-Link wird nie doppelt angelegt; ist der Link dort mehrdeutig, wird der Eintrag übersprungen.
- Übergabe über die gemeinsame IndexedDB `tool-transfer`; der Image Ranker übernimmt die Einträge beim nächsten Öffnen (oder sofort, wenn er offen ist). Ist ein Eintrag im Reiter schon vorhanden (Verknüpfung, gleiches Bild oder gleicher Link), werden nur Eigenschaften und Link aktualisiert – Bild, Elo und Duelle bleiben.
- Babepedia-Bilder holt das **Userscript (ab 14.2)** als Datei; ohne Userscript werden sie als Link angelegt. Eigene Bilder werden direkt übernommen.
- **Rückweg:** Auf PC/Laptop liest der Babe Organizer den Ranker (nur lesend) und zeigt **Tier · Score** auf der Karte und **Platz** in der Detailansicht (Klick öffnet das Bild im Ranker). Filter „im Image Ranker (Tool)“ und Sortierung „Image-Ranker-Score“. Der Stand wird im Eintrag (`_ranker`) gemerkt und synchronisiert, so ist er auch am Handy sichtbar.

## Änderungen in 14.2 (Userscript)
- Holt auf Anfrage des Tools Bilder von Babepedia bzw. dem Internet Archive für „An Image Ranker senden“.

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

## Änderungen in 13.8 (Skript)
- Skript liegt jetzt im Repo; Tampermonkey aktualisiert es automatisch über `@updateURL`.
- `TOOL_URL` fest auf `https://thevizce.github.io/b-organizer/` gesetzt, Skript läuft auf github.io nur noch auf dieser Seite.

## Änderungen in 13.9
- Fehlt das Hauptbild, wird automatisch ein anderes Bild (Bild 2–4 oder das erste User-Upload-Bild) als Cover genutzt. Lädt ein Bild nicht oder ist es nur eine Platzhalter-Grafik, probiert das Tool das nächste.
- Skript: Bei Profilen ohne Foto speichert Babepedia statt Bildern „Foto hochladen“-Links (`/uploadphotos/…`). Diese werden nicht mehr als Image 2–4 übernommen. Bereits gespeicherte Einträge mit solchen Links zeigt das Tool trotzdem korrekt an.

## Änderungen in 14.0
- **Measurements** werden immer in **cm** gespeichert und angezeigt (Format Brust-Taille-Hüfte, `xx-xx-xx`).
- Im Bearbeiten-Formular gibt es neben dem Feld eine Auswahl **cm / inch**. Bei „inch“ wird beim Speichern in cm umgerechnet und gerundet; der Hinweis darunter zeigt das Ergebnis schon beim Tippen.
- Bereits gespeicherte Werte in Inch (Brustweite unter 60) rechnet das Tool beim Laden automatisch in cm um.
- Skript: erkennt die Einheit auf Babepedia (in/cm) und speichert immer cm.

## Änderungen in 14.1 (Tool)
- **Eigene Bilder**: Im Bearbeiten-Formular unter „Bilder“ lassen sich Bilddateien hochladen (Auswahl oder Drag & Drop), z. B. für gelöschte Profile. Sie werden auf max. 1600 px verkleinert und nur in diesem Browser (IndexedDB) gespeichert – nicht im Repo.
- Mit ★ ein Bild als **Cover** festlegen – im Formular für eigene Bilder, in der Detailansicht für jedes Bild. Ohne Festlegung gilt das erste verfügbare Bild.
- Das JSON-Backup enthält die eigenen Bilder (Version 2) und stellt sie beim Import wieder her. Der CSV-Export enthält sie nicht.
- Ungespeicherte Uploads werden beim Abbrechen verworfen, entfernte Bilder und Bilder gelöschter Einträge werden mitgelöscht.

## Änderungen in 14.2 (Tool) – Performance
- Karten/Tabellenzeilen werden in Etappen erzeugt (60 Stück) und beim Scrollen nachgeladen, statt alle ~3700 auf einmal.
- Karten, Tabelle und Bilder-Raster laden Babepedias kleine Vorschaubilder (`_thumb3` bzw. `user-uploads-thumbs`) statt der großen Originale; groß nur in der Detail-Ansicht/Lightbox. Fehlt ein Vorschaubild, wird automatisch das große genommen.
- Sortierung berechnet die Schlüssel nur einmal pro Eintrag; Suche wartet kurz, bis man zu tippen aufhört.
- Favorit/Bewertung aktualisieren nur die betroffene Karte (Scrollposition bleibt), schnelle Änderungen werden zu einem Speichervorgang gebündelt.

## Änderungen in 14.3 – Internet Archive
- Archivierte Babepedia-Profile (`https://web.archive.org/web/<Zeitstempel>/https://www.babepedia.com/babe/<Name>`) lassen sich übernehmen: Seite öffnen → **➕ Aus Archiv übernehmen** → **🗂️ Tool öffnen**.
- Bilder werden als Archiv-Adressen gespeichert (bei gelöschten Profilen gibt es die Originale nicht mehr); Profil-URL bleibt die Babepedia-Adresse, damit vorhandene Einträge erkannt werden.
- Neues Feld **Archive URL**; im Tool als Link „🏛️ Internet Archive“ und Chip „aus dem Archiv“.
- Im Archiv-Modus werden keine Babepedia-Listen verändert; „User Rating“ wird nicht übernommen.
- Sehr alte Archiv-Kopien mit anderem Seitenaufbau werden evtl. nicht erkannt – dann erscheint eine Meldung.

## Änderungen in 14.4 (Tool) / 14.3 (Skript)
- Neues Feld **Thronly** (Link) bei den Links; im Formular als URL-Feld. Das Skript übernimmt Thronly-Links, falls Babepedia sie im Profil anzeigt.
- Filter **Fehlende Werte**: Einträge, denen Profession, Nationality, Hair Color, Born oder Bra/Cup fehlt (einzeln oder „irgendeiner“) – die Felder, die auch der Image Ranker nutzt. In der Detailansicht zeigt ein Chip „⚠ fehlt: …“, was fehlt.

## Änderungen in 14.5 (Tool) / 14.4 (Skript) – umbenannte Profile
- Neues Feld **Babe ID** (feste Babepedia-Nummer, ändert sich beim Umbenennen nicht). Das Skript speichert sie mit; das Tool ordnet zuerst darüber zu.
- Bei Einträgen ohne Babe ID erkennt das Tool umbenannte Profile über den alten Namen im AKA bzw. eine andere Schreibweise der URL und **fragt nach**, ob der vorhandene Eintrag aktualisiert werden soll.
- Gibt es schon beide Einträge, bietet es an, sie **zusammenzuführen**: Der ältere Eintrag bleibt (ID, Notizen, Bewertungen, Ranker-Verknüpfung), bekommt die neuen Daten; das Duplikat wird entfernt.
- Beim Einlesen von Backups gibt es keine Rückfragen (Einträge werden über ihre ID zugeordnet).

## Änderungen in 14.6 (Tool) / 14.5 (Skript) – Umbenennungen nur noch mit Beleg
- Umbenannte Profile werden nicht mehr über die weiteren Namen (AKA) geraten. Das Tool lässt das Skript prüfen, wohin die alte Babepedia-Adresse heute führt: nur bei Weiterleitung auf die neue Adresse oder gleicher Babe ID gilt es als dasselbe Profil.
- Bestätigte Umbenennung: vorhandener Eintrag wird ohne Rückfrage aktualisiert. Gibt es schon ein Duplikat, wird vor dem Zusammenführen gefragt.
- Ohne Skript (z. B. Datei-Import) wird nichts zusammengeführt.

## Änderungen in 14.7 (Tool) – Bild im Filter „Fehlende Werte“
- Neuer Wert **Bild**: fehlt, wenn ein Eintrag kein Bild hat oder keines davon lädt. Das Tool merkt sich das lokal (IndexedDB `bp-organizer`, Schlüssel `imgcheck`, nicht im Sync) – beim Anschauen nebenbei und über einen Prüflauf, der beim Wählen eines Bild-Filters automatisch für ungeprüfte Einträge startet (Fortschritt unten, abbrechbar). Ändern sich die Bilder eines Eintrags, wird neu geprüft. *Daten → Alle Bilder neu prüfen* prüft alles erneut.
- Filter erweitert: **„fehlt: X“** (X fehlt, andere evtl. auch) und **„nur X fehlt“** (alle anderen Werte vorhanden).
- **An Ranker senden**: Für neu angelegte Ranker-Bilder wird ein Bild gesucht, das wirklich lädt – zuerst das gewählte, dann die übrigen Bilder des Eintrags, zuletzt die Vorschaubilder. Lädt bei einem Eintrag gar nichts, fragt das Tool vor dem Senden, ob diese Einträge weggelassen oder ohne Bild angelegt werden sollen (vorher wurde still ein toter Link angelegt).

## Änderungen in 14.8 (Tool) – Doppel-Einträge und eigene Ansicht
- Umbenennungen werden auch erkannt, wenn der alte Name einen Zusatz in Klammern hatte (z. B. `Ariadna_Majewska_(Ari_Maj)` → `Ariadna_Majewska`). Bestätigt wird weiterhin nur über Babepedia (Weiterleitung oder gleiche Babe ID).
- **Daten → Doppel-Einträge suchen**: prüft bereits vorhandene Paare über das Skript und bietet pro bestätigtem Paar „Zusammenführen“ an. Es bleibt der ältere bzw. im Ranker verknüpfte Eintrag (ID, eigene Felder, Ranker-Verknüpfung); die Babepedia-Daten kommen von der aktuellen Profiladresse.
- **⚙︎ Ansicht**: Angaben unter dem Namen auf den Kacheln (Reihenfolge = Klick-Reihenfolge), Abzeichen auf dem Bild, sichtbare Filter und zusätzliche Filter (z. B. Ethnicity, Geburtsjahr, Tattoos – mit allen vorkommenden Werten und „leer“) selbst wählen. Gespeichert pro Gerät im localStorage (`bp-organizer-ui`), nicht im Sync.

## Änderungen in 14.9 (Tool) – Tippfehler-Umbenennungen, Babepedia schonen
- Umbenennungen mit korrigiertem Tippfehler werden erkannt (z. B. `Grace_Bhattaria` → `Grace_Bhattarai`: vertauschte, fehlende oder falsche Buchstaben). Kandidaten mit unterschiedlichem Geburtsdatum werden gar nicht erst geprüft; bestätigt wird weiter nur über Babepedia.
- Prüfungen bei Babepedia: höchstens ein Abruf alle 2,5 s, jede Adresse nur einmal pro Sitzung, bei bekannten Babe IDs gar kein Abruf. Meldet Babepedia eine Sperre (429 / Cloudflare 1015, 403, 503), pausieren alle Prüfungen 30 Minuten und die Doppel-Suche bricht mit Hinweis ab.

## Änderungen in 14.10 (Tool) – Limit beim Senden an den Ranker
- **🏆 An Ranker** hat ein einstellbares Limit („Höchstens N Einträge, die noch nicht im Ranker sind“). Es gilt in der aktuellen Sortierung; schon verknüpfte Einträge zählen nicht mit. Der Rest steht unter „⏸ Später“ und kommt beim nächsten Senden dran. Das Limit wird gemerkt (leer = alle).
- Einträge aus einem Auftrag, den der Image Ranker noch nicht abgeholt hat, werden nicht noch einmal gesendet („⏳ Schon gesendet, wartet auf den Ranker“). So entstehen keine Doppelten, wenn du mehrmals hintereinander sendest, ohne den Ranker zu öffnen.

## Änderungen in 14.11 (Tool) – Ranker nur über die Verknüpfung
- Filter „Ranker“ und 🏆-Anzeige (Kachel, Tabelle) richten sich nur noch nach der Verknüpfung mit dem Image Ranker. Die Optionen zur Babepedia-Liste sind weg.
- Das Feld „In Ranker“ wird nicht mehr angezeigt oder bearbeitet. Die Werte bleiben in den Daten (Backup, Sync, CSV) erhalten.

## Änderungen in 14.12 (Tool) – Statistik
- Neue Ansicht **📊 Statistik** (neben Karten/Tabelle): Kennzahlen (Favoriten, im Ranker, aktiv, Ø Alter/Größe/Ratings), Häufigkeit aller Eigenschaften (Nationalität, Bereich, Professions, Haare, Augen, Figur, Ethnicity, Cup, Boobs, Sexuality, Tattoos, Piercings, Tags, Geburtsland/-ort …), Verteilungen (Alter, Geburtsjahrzehnt, Größe, Gewicht, Ratings), Ranker-Tiers und wie vollständig die Felder ausgefüllt sind.
- Gilt immer für die aktuell gefilterte Liste. Ein Klick auf eine Zeile filtert die Liste danach (Chip in der Leiste, ✕ entfernt ihn).

## Änderungen in 14.13 (Tool) – Blättern und Wischen
- **Detailansicht:** ‹ › oben (mit „3 / 120“), Pfeiltasten ← → oder seitlich wischen wechseln zum vorherigen/nächsten Eintrag der aktuellen Liste (Filter und Sortierung gelten).
- **Bild-Betrachter:** Klick aufs Titelbild oder ein Bild im Raster öffnet alle Bilder groß. ← → / seitlich wischen = nächstes Bild; nach dem letzten Bild geht es mit dem nächsten Eintrag weiter (Einträge ohne Bilder werden übersprungen). ↑ ↓ / „⏮ Eintrag“ „Eintrag ⏭“ / nach oben wischen = Eintrag wechseln, nach unten wischen oder Esc = schließen, Doppelklick/Doppeltipp = Zoom. Der Name oben öffnet die Details.
- **🖼 Blättern** in der Leiste startet den Betrachter mit der ganzen aktuellen Liste.

## Änderungen in 14.14 (Tool) – Zufall und Tastenkürzel
- **🎲 Zufall** in der Leiste (oder Taste `Z`): öffnet einen zufälligen Eintrag aus der aktuell gefilterten Liste. In der Detailansicht holt 🎲 bzw. `Z` den nächsten zufälligen, im Bild-Betrachter springt `Z` zu einem zufälligen Eintrag.
- Sortierung **🎲 Zufällige Reihenfolge**: mischt die Liste (erneut wählen = neu mischen); Blättern und Bild-Betrachter folgen dieser Reihenfolge.
- Tastenkürzel (Übersicht mit `?` oder *Daten → Tastenkürzel & Gesten*): `/` Suche, `B` Bilder blättern, `N` neuer Eintrag; im Detail `F` Favorit, `1`–`9`/`0` Bewertung, `Entf` Bewertung löschen, `E` bearbeiten, Leertaste Bilder.

## Änderungen in 14.15 (Tool) – Aktualisierungen prüfen
- Holt das Skript Profile, die schon im Tool sind, werden Änderungen nicht mehr direkt geschrieben. Das Fenster **Aktualisierungen prüfen** zeigt pro Eintrag alt → neu (Bilder als Vorschau +/−). Felder per Häkchen wählen, dann **Übernehmen** oder **Ablehnen** – einzeln oder alle auf einmal.
- Nicht Entschiedenes bleibt offen (Knopf **⟳ Änderungen (n)** oben). Abgelehnte Werte werden gemerkt und erst wieder angeboten, wenn Babepedia etwas anderes liefert.
- Rank, Highest Rank, Votes, Global Rating, Peakdays und Scraped At werden standardmäßig direkt übernommen (abschaltbar), eine bisher leere Babe ID immer; schon offene Änderungen an diesen Feldern werden beim Öffnen des Tools nachgetragen. Mit „Künftig nicht mehr fragen“ geht alles wieder direkt rein. Neue Einträge, Backups (JSON mit `_id`) und bestätigte Umbenennungen werden weiterhin direkt übernommen.
- Speicher: zwei neue Schlüssel in der eigenen IndexedDB `bp-organizer` (`pending-updates`, `rejected-updates`), nur auf diesem Gerät, nicht im Sync.

## Änderungen in 14.16 (Tool) – Ranker veraltet
- Das Tool vergleicht bei verknüpften Einträgen die Eigenschaften, die du beim Senden pro Ranker-Reiter gewählt hast, mit den Werten im Image Ranker (nur lesend). Weichen sie ab, erscheint **⟳ Ranker** auf der Kachel und in der Detailansicht „Im Ranker veraltet: … – nochmal senden“ (Klick öffnet das Senden).
- Filter **Ranker → ⟳ im Ranker veraltet** zeigt alle betroffenen; danach **🏆 An Ranker** für die ganze Liste. Nach dem Übernehmen im Ranker verschwindet die Markierung von selbst.
- Funktioniert auf dem Gerät, auf dem der Image Ranker läuft und von dem aus gesendet wurde (dort liegt die Feldauswahl). Kein neuer Speicher.

## Änderungen in 14.10 (Skript) / Tool – Ranker-Liste auf Babepedia entfällt
- Der Knopf **🏆 Ranker-Abgleich** und die Übergabe der Babepedia-Liste „Ranker“ (ID 172740) ans Tool sind entfernt. Ob ein Eintrag im Image Ranker ist, kommt nur noch aus der Verknüpfung im Tool.
- Die Liste selbst wird vom Skript weiter erkannt und beim Holen nicht verändert. Das alte Feld „In Ranker“ bleibt in den Daten, wird aber nirgends mehr gesetzt oder angezeigt.

## Änderungen in 14.11 (Skript) – aufgeräumt
- Entfernt: **🗑️ Clear Batch**, **📥 Download CSV**, **📋 Copy Babe Links** und **🔄 Move Lists Only**. Die Profile gehen direkt ins Tool (CSV-Export gibt es dort unter *Daten*), Auto Fetch verschiebt NEU → GELISTET selbst.
- Notfall statt Clear Batch: **Shift+Klick auf „🗂️ Tool öffnen“** verwirft die gesammelten Profile (mit Rückfrage).
- **📋 Alle Links kopieren** erscheint jetzt auf allen Kachel-Seiten (Top 100, Suche …) neben „🆕 Neue Links kopieren“.

## Änderungen in 14.13 (Skript) / Tool – rollierendes Update
- Neuer Knopf **🔁 Update (älteste)**: holt nur die N Profile neu, die im Tool am längsten nicht aktualisiert wurden (nach *Scraped At*; Anzahl wählbar, Standard 300, wird gemerkt). Listen werden dabei nicht verändert. So ist nach einigen Läufen alles einmal aktuell, ohne stundenlangen Komplett-Fetch.
- Den Stand bekommt das Skript vom Tool (beim Öffnen und nach jeder Übernahme). Was das Skript selbst geholt hat, merkt es sich zusätzlich, damit zwei Läufe hintereinander nicht dieselben Profile holen – auch wenn das Tool dazwischen nicht geöffnet war. Profile, die nur im Internet Archive liegen, sind ausgenommen.
- Auto Fetch und Update versuchen Fehlschläge am Ende nach einer Minute Pause einmal erneut und fragen dann „Jetzt ins Tool übernehmen?“ (öffnet das Tool direkt).

## Änderungen in 14.17 (Tool) – UK-Landesteile → British
- Nationalitäten „English“, „Scottish“, „Welsh“ und „Northern Irish“ werden zu „British“ zusammengelegt (Babepedia nutzt British teils synonym; „Irish“ bleibt): vorhandene Einträge beim ersten Öffnen (wird gespeichert und synchronisiert), neue und aktualisierte Profile beim Übernehmen. Doppelte („British, English“) werden zu einem Wert. Die Zuordnung steht in `NAT_MERGE` in `app.js`.
- Das Skript bleibt unverändert: alles, was ins Tool kommt, läuft durch dieselbe Umstellung, und „Aktualisierungen prüfen“ zeigt dadurch kein English → British als Änderung.

## Änderungen in 14.18 (Tool) – Nationalität mit Flagge an den Ranker
- Beim Senden an den Image Ranker wird die Nationalität immer als „Flagge Name“ geschickt (z. B. „🇬🇧 British“), auch wenn sie im Tool von Hand ohne Flagge eingetragen wurde. Vorher landete „British“ im Ranker als eigener Auswahlwert neben „🇬🇧 British“.

## Änderungen in 14.15 (Skript) / Tool – Measurements und Bra/Cup sauber
- Measurements mit unbekannten Teilen („?–68.6–81.3 cm (B–W–H) · WHR 0.84“) werden als „?-69-81“ gespeichert; nur „?“ ergibt ein leeres Feld.
- Bra/Cup mit Zusatz in Klammern („F (32F US / 70H JP)“, „D (old cup size: B)“) wird auf den Cup gekürzt.
- Vorhandene Einträge stellt das Tool beim nächsten Öffnen um und speichert sie.

## Änderungen in 14.19 (Tool) – Weltkarte
- In der **📊 Statistik** oben eine Weltkarte: Länder nach Häufigkeit eingefärbt, umschaltbar **Nationalität / Geburtsland** (Land aus „Stadt, Region, Land“ der Birthplace) und Ausschnitte Welt, Europa, Nord-/Südamerika, Afrika, Asien. Kleine Länder als Punkt. Land antippen → Anzahl und „Liste zeigen“ (filtert die Liste). Gilt wie die übrige Statistik für die gefilterte Liste.
- Kartendaten: `world.json` (Natural Earth 1:50m, gemeinfrei, vorab vereinfacht, ~180 KB, wird erst beim Öffnen der Statistik geladen). Keine externen Bibliotheken.

## Änderungen in 14.20 (Tool) – Bewertung nach Kategorien
- Neue eigene Felder (werden synchronisiert, nie von Babepedia überschrieben): **Face Score** (inkl. Haare), **Body Score**, **Hot Score**, **Cute Score** (je 1–5, halbe Schritte) und **Sympathy Score** (Leitfaden – Bekannt: 5 sehr · 4 eher sympathisch · 3 durchschnittlich · 2 eher · 1 sehr unsympathisch; Unbekannt: 3 wirkt eher sympathisch · 2,5 wirkt durchschnittlich · 2 wirkt eher unsympathisch; leer zählt als 2,5).
- Gesamt = (2·Gesicht + 2·Body + max(Hot, Cute) + 0,1·min(Hot, Cute) + 1,5·Sympathie) / 6,5. **Score** (1–10 mit Nachkomma): Gesamt 3 = 7, darüber +2 je Punkt (ab 4,5 = 10), darunter −3 je Punkt (1 = 1); **My Rating** = gerundeter Score, sobald Gesicht, Body und Hot oder Cute bewertet sind. Die bisherige My Rating wird beim ersten Berechnen als **My Rating (old)** aufgehoben.
- Detailansicht: Knopfreihen pro Kategorie mit Ergebnis und Vergleich zu Babepedia. **⭐ Bewerten** (Taste `R`): Eintrag für Eintrag mit großem Bild; `1`–`5` setzt die markierte Kategorie und springt weiter, `.` = +½, `↑`/`↓` oder `G B H C S` = Kategorie, `←`/`→` = Bild, `Enter` = nächster Eintrag.
- Filter „Bewertung“: nach Kategorien bewertet / noch nicht / Note ≠ Babepedia. Sortierung „★ Score“. Statistik: Verteilungen je Kategorie und Vergleich mit Babepedia. Die Kategorien lassen sich auch als Kachel-Angabe, Zusatzfilter und Ranker-Eigenschaft wählen.
- Bewertungsmodus mit **Vergleich**: Unter den Kategorien stehen die Einträge, die in der markierten Kategorie denselben Wert haben (Knöpfe für die anderen vergebenen Werte, bis zu 12 Vorschaubilder). Antippen zeigt deren Bild groß; erneutes Antippen des Bildes zurück.

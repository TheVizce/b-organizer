# Babe Organizer – Hinweise für Claude

## Dieses Tool
- IndexedDB `bp-organizer`, localStorage-Präfixe `bp-organizer`, `bp_batch_data`. Dazu das Tampermonkey-Skript `babepedia-organizer.user.js` (Version im Header hochzählen).
- Sync: Ordner `b-organizer/` (32 Teildateien). `collections: entries {type:'array', id:'_id'}`. Eigene Bilder bleiben lokal.
- `SYNC.changed()` steckt in `save()`.
- **Übergabe an den Image Ranker:** über die gemeinsame IndexedDB `tool-transfer` (Store `jobs`) und `BroadcastChannel('tool-transfer')`. Der Image Ranker verarbeitet das in seiner `ranker-inbox.js`. Den Ranker (`ImageRankerDB`) nur lesen, nie beschreiben.
- Keine automatischen Verknüpfungen nur über den Namen: unklare Fälle verknüpft der Nutzer von Hand, damit im Ranker keine Doppelten entstehen.
- Deep-Link `#e=<id>` öffnet einen Eintrag.
- **Reiter Charaktere** (`?k=chars`, `IS_CHARS` in app.js): gleicher Code, getrennte Daten. IndexedDB-Schlüssel mit Präfix `chars:` (`chars:entries`, `chars:duels`, …; Bilder `img:` gemeinsam), localStorage `bp-organizer-ui-chars` / `bp-organizer-ranker-chars`, Sync-Ordner `b-organizer-chars/` (8 Teildateien, gleiche collections). Keine Babepedia-Funktionen und keine Skript-Nachrichten (BP_*) im Charakter-Reiter. Import-Dateien mit `kind: 'chars'` nur dort. Bewerten nur bei `Adult = ja`. Verknüpfen mit vorhandenen Ranker-Bildern nur nach Bestätigung (Auftrag mit `linkTo`, `create: false`).

## Gemeinsame Regeln für alle Tools unter thevizce.github.io

Alle Tools laufen unter derselben Adresse und teilen sich Speicher. Übersicht, Speicheranzeige und Sync-Einstellungen: Repo `startseite` (https://thevizce.github.io/startseite/).

**Speicher**
- localStorage ist für alle Tools gemeinsam (~5 MB). Nur kleine Daten (deutlich unter 500 KB) mit dem eigenen Präfix, nie `localStorage.clear()`.
- Größere Daten in die eigene IndexedDB (Name unten). Fremde Datenbanken nie beschreiben.
- Speicherfehler sichtbar anzeigen. JSON-Export/Import muss weiter funktionieren.
- Formatänderungen: alte Daten beim Start automatisch übernehmen, alte Schlüssel erst danach entfernen.
- Vor Änderungen am Speicher dem Nutzer kurz Befund und empfohlene Variante nennen, danach eine kurze Umstiegs-Anleitung gegen Datenverlust geben.

**GitHub-Sync (`/startseite/sync-v1.js`)**
- Das Tool gleicht über `ToolSync.create({...})` mit dem privaten Repo `TheVizce/tool-daten` ab. Token und Repo trägt der Nutzer nur auf der Startseite ein (`localStorage["toolsync.config"]`). Keine eigenen Token-Felder oder eigenen GitHub-Uploads bauen.
- Nach jedem erfolgreichen Speichern muss `SYNC.changed()` aufgerufen werden (Stelle unten). Neue Speicherwege ebenfalls daran anschließen.
- Neue Datenfelder oder Listen müssen in `get`/`apply` und in `collections`/`fields` ergänzt werden, sonst werden sie nicht abgeglichen oder gehen beim Übernehmen aus der Cloud verloren.
- Einträge in Listen brauchen eine stabile `id` (bzw. das angegebene ID-Feld). IDs nie neu vergeben, nicht umbenennen.
- Ein Eintrag gelöscht = Löschung wird gemerkt. Daten nicht durch Löschen + Neuanlegen „umbauen“.
- `sync-v1.js` nicht kopieren und nicht im Tool-Repo ändern. Änderungen daran nur im Repo `startseite`, abwärtskompatibel; Inkompatibles als `sync-v2.js`.
- Das ☁︎-Feld unten links (mit ⌂ zur Startseite) kommt aus dem Sync. Keinen eigenen Zurück-Knopf bauen, der dort kollidiert.

**Sonst**
- iPhone: Kopfzeilen mit `env(safe-area-inset-top)` und `viewport-fit=cover` beibehalten.
- Direkte Pushes auf `main` sind erlaubt. Nicht gleichzeitig aus zwei Chats am selben Tool arbeiten.
- Neue Tools oder neue Datenbanken in `startseite/index.html` (Liste `TOOLS`) eintragen.

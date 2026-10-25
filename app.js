/* Babe Organizer – läuft komplett im Browser, Daten liegen im localStorage. */
(() => {
  'use strict';

  // ---------- Schema (identisch zum Userscript) ----------
  const FIELDS = [
    'Name', 'AKA', 'Profile URL', 'Main Image URL',
    'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links', 'Scraped At',
    'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays',
    'Born', 'Exact Birthdate', 'Died', 'Years active', 'Active', 'Active till', 'Birthplace',
    'Nationality', 'Ethnicity', 'Professions', 'Sexuality', 'Hair color',
    'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup',
    'Boobs', 'Tattoos', 'Piercings',
    'Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch',
    'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Boobpedia Link'
  ];
  // Eigene Felder (werden vom Import nie überschrieben, außer der Import bringt selbst Werte mit)
  const OWN_FIELDS = ['Favorite', 'My Rating', 'Tags', 'Notes'];
  const ALL_FIELDS = [...FIELDS, ...OWN_FIELDS];

  const GROUPS = [
    { title: 'Allgemein', fields: ['Name', 'AKA', 'Born', 'Exact Birthdate', 'Died', 'Birthplace', 'Nationality', 'Ethnicity', 'Professions', 'Sexuality', 'Years active', 'Active', 'Active till'] },
    { title: 'Aussehen', fields: ['Hair color', 'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup', 'Boobs', 'Tattoos', 'Piercings'] },
    { title: 'Eigene Angaben', fields: ['Favorite', 'My Rating', 'Tags', 'Notes'] },
    { title: 'Babepedia', fields: ['Profile URL', 'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays', 'Scraped At'] },
    { title: 'Bilder', fields: ['Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links'] },
    { title: 'Links', fields: ['Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch', 'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Boobpedia Link'] }
  ];
  const LINK_FIELDS = GROUPS[5].fields;

  const TYPES = {
    'Born': 'date', 'Died': 'date', 'Scraped At': 'date',
    'Exact Birthdate': 'bool', 'Active': 'bool', 'Favorite': 'bool',
    'Tattoos': ['n/a', 'Ja', 'Nein'], 'Piercings': ['n/a', 'Ja', 'Nein'],
    'Boobs': ['', 'Real/Natural', 'Fake/Enhanced', 'Real (Removed implants)', 'Unknown'],
    'Height': 'num', 'Weight': 'num', 'Global Rating': 'num', 'Votes': 'num', 'User Rating': 'num',
    'Rank': 'num', 'Highest Rank': 'num', 'Peakdays': 'num', 'Years active': 'num', 'Active till': 'num',
    'My Rating': 'num',
    'User Upload Image URLs': 'area', 'Gallery Links': 'area', 'Notes': 'area'
  };
  const HINTS = {
    'Height': 'in cm', 'Weight': 'in kg', 'Measurements': 'z. B. 86-61-89', 'Bra/Cup': 'nur Cup, z. B. D',
    'Tags': 'kommagetrennt', 'My Rating': '0–10', 'Years active': 'Startjahr', 'Active till': 'Endjahr, falls inaktiv',
    'User Upload Image URLs': 'kommagetrennt', 'Gallery Links': 'kommagetrennt',
    'Exact Birthdate': 'aus = nur Jahr bekannt'
  };
  const UNITS = { 'Height': ' cm', 'Weight': ' kg' };

  const STORE_KEY = 'bp-organizer-v1';
  const UI_KEY = 'bp-organizer-ui';

  // ---------- Zustand ----------
  let entries = load();
  const ui = Object.assign({ view: 'grid', sort: 'name' }, safeJSON(localStorage.getItem(UI_KEY), {}));

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  function safeJSON(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }
  function load() {
    const d = safeJSON(localStorage.getItem(STORE_KEY), []);
    return Array.isArray(d) ? d : [];
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); }
    catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, 'err'); }
  }
  function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch {} }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const v = (e, f) => (e[f] ?? '').toString().trim();
  const isTrue = (x) => String(x).toLowerCase() === 'true';
  const num = (x) => { const n = parseFloat(String(x).replace(',', '.')); return isNaN(n) ? null : n; };
  const splitList = (s) => String(s || '').split(/[,\n]+/).map(t => t.trim()).filter(Boolean);

  // Datum: gespeichert als TTMMJJJJ (wie im Userscript)
  function ddToIso(s) { s = String(s || ''); return /^\d{8}$/.test(s) ? `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : ''; }
  function isoToDd(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + m[2] + m[1] : ''; }
  function fmtDate(s, exact = true) {
    s = String(s || '');
    if (!/^\d{8}$/.test(s)) return s;
    return exact ? `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4)}` : s.slice(4);
  }
  function age(e) {
    const iso = ddToIso(v(e, 'Born'));
    if (!iso) return null;
    const b = new Date(iso);
    const end = ddToIso(v(e, 'Died')) ? new Date(ddToIso(v(e, 'Died'))) : new Date();
    let a = end.getFullYear() - b.getFullYear();
    if (isTrue(e['Exact Birthdate'])) {
      const m = end.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && end.getDate() < b.getDate())) a--;
    }
    return a;
  }
  function images(e) {
    const list = ['Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL'].map(f => v(e, f)).filter(Boolean);
    splitList(e['User Upload Image URLs']).forEach(u => list.push(u));
    return [...new Set(list)];
  }
  const initials = (n) => (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const imgTag = (src, alt, cls = '') => src
    ? `<img src="${esc(src)}" alt="${esc(alt)}" class="${cls}" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(initials(alt))}">`
    : `<div class="placeholder">${esc(initials(alt))}</div>`;

  // Kaputte Bilder durch Initialen ersetzen
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (img.tagName === 'IMG' && img.dataset.fallback !== undefined && !img.dataset.failed) {
      img.dataset.failed = '1';
      const ph = document.createElement('div');
      ph.className = 'placeholder';
      ph.textContent = img.dataset.fallback;
      img.replaceWith(ph);
    }
  }, true);

  // ---------- Import / Zusammenführen ----------
  function keyOf(e) {
    const url = v(e, 'Profile URL').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
    return url ? 'url:' + url : 'name:' + v(e, 'Name').toLowerCase();
  }
  function importItems(items) {
    let added = 0, updated = 0, skipped = 0;
    const index = new Map(entries.map(e => [keyOf(e), e]));
    const now = Date.now();
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') { skipped++; continue; }
      const item = {};
      for (const f of ALL_FIELDS) if (raw[f] !== undefined && raw[f] !== null) item[f] = String(raw[f]).trim();
      if (!item.Name) { skipped++; continue; }
      const k = keyOf(item);
      const existing = index.get(k);
      if (existing) {
        for (const f of ALL_FIELDS) if (item[f]) existing[f] = item[f];
        existing._updated = now;
        updated++;
      } else {
        const e = { _id: raw._id || uid(), _created: raw._created || now, _updated: now };
        for (const f of ALL_FIELDS) e[f] = item[f] || '';
        if (!e.Favorite) e.Favorite = 'false';
        entries.push(e);
        index.set(k, e);
        added++;
      }
    }
    save();
    refreshFilters();
    render();
    return { added, updated, skipped };
  }

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim());
    return rows.filter(r => r.some(c => c.trim() !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }
  function toCSV(list) {
    const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    return [ALL_FIELDS.map(q).join(','), ...list.map(e => ALL_FIELDS.map(f => q(e[f])).join(','))].join('\n');
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function stamp() { const d = new Date(); return d.toISOString().slice(0, 10); }

  async function handleFile(file) {
    const text = await file.text();
    let items;
    try {
      if (/\.json$/i.test(file.name) || /^\s*[\[{]/.test(text)) {
        const data = JSON.parse(text);
        items = Array.isArray(data) ? data : (data.entries || []);
      } else {
        items = parseCSV(text);
      }
    } catch (err) {
      toast('Datei konnte nicht gelesen werden: ' + err.message, 'err');
      return;
    }
    if (!items.length) { toast('Keine Einträge in der Datei gefunden.', 'err'); return; }
    const r = importItems(items);
    toast(`Import: ${r.added} neu, ${r.updated} aktualisiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, 'ok');
  }

  // ---------- Brücke zum Userscript ----------
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'BP_PING') window.postMessage({ type: 'BP_TOOL_READY' }, location.origin);
    if (d.type === 'BP_SYNC' && Array.isArray(d.items)) {
      const r = importItems(d.items);
      window.postMessage({ type: 'BP_SYNC_ACK', id: d.id, ...r }, location.origin);
      toast(`Von Babepedia übernommen: ${r.added} neu, ${r.updated} aktualisiert.`, 'ok');
    }
  });

  // ---------- Filter & Sortierung ----------
  const FILTERS = { 'f-nationality': 'Nationality', 'f-hair': 'Hair color', 'f-eyes': 'Eye color', 'f-body': 'Body type' };

  function refreshFilters() {
    for (const [id, field] of Object.entries(FILTERS)) {
      const sel = $('#' + id);
      const cur = sel.value;
      const vals = new Set();
      entries.forEach(e => {
        const raw = v(e, field);
        if (!raw) return;
        (field === 'Nationality' ? raw.split(',') : [raw]).forEach(x => x.trim() && vals.add(x.trim()));
      });
      const first = sel.options[0].outerHTML;
      sel.innerHTML = first + [...vals].sort((a, b) => a.localeCompare(b, 'de')).map(x => `<option>${esc(x)}</option>`).join('');
      sel.value = vals.has(cur) ? cur : '';
    }
  }

  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const fv = Object.fromEntries(Object.entries(FILTERS).map(([id, f]) => [f, $('#' + id).value]));
    const act = $('#f-active').value;
    const fav = $('#f-fav').checked;

    let list = entries.filter(e => {
      if (fav && !isTrue(e.Favorite)) return false;
      if (act && String(v(e, 'Active') || 'false') !== act) return false;
      for (const [f, val] of Object.entries(fv)) {
        if (!val) continue;
        if (f === 'Nationality' ? !v(e, f).split(',').map(s => s.trim()).includes(val) : v(e, f) !== val) return false;
      }
      if (terms.length) {
        const hay = [e.Name, e.AKA, e.Tags, e.Notes, e.Birthplace, e.Professions, e.Nationality].join(' ').toLowerCase();
        if (!terms.every(t => hay.includes(t))) return false;
      }
      return true;
    });

    const by = {
      name: (a, b) => v(a, 'Name').localeCompare(v(b, 'Name'), 'de'),
      created: (a, b) => (b._created || 0) - (a._created || 0),
      updated: (a, b) => (b._updated || 0) - (a._updated || 0),
      global: (a, b) => (num(b['Global Rating']) ?? -1) - (num(a['Global Rating']) ?? -1),
      mine: (a, b) => (num(b['My Rating']) ?? -1) - (num(a['My Rating']) ?? -1),
      rank: (a, b) => (num(a.Rank) ?? 1e9) - (num(b.Rank) ?? 1e9),
      young: (a, b) => (age(a) ?? 999) - (age(b) ?? 999),
      old: (a, b) => (age(b) ?? -1) - (age(a) ?? -1),
      height: (a, b) => (num(b.Height) ?? -1) - (num(a.Height) ?? -1)
    }[ui.sort] || ((a, b) => 0);
    return list.sort((a, b) => by(a, b) || v(a, 'Name').localeCompare(v(b, 'Name'), 'de'));
  }

  // ---------- Darstellung ----------
  function metaLine(e) {
    const a = age(e);
    return [v(e, 'Nationality'), a !== null ? `${a} J.` : '', v(e, 'Height') ? v(e, 'Height') + ' cm' : ''].filter(Boolean).join(' · ');
  }

  function render() {
    const list = filtered();
    $('#count').textContent = list.length === entries.length ? `${entries.length} Einträge` : `${list.length} von ${entries.length}`;
    $$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
    $('#sort').value = ui.sort;
    const main = $('#main');

    if (!entries.length) {
      main.innerHTML = `<div class="empty"><h2>Noch keine Einträge</h2>
        <p>Füge Profile über das Babepedia-Skript hinzu, importiere eine CSV-Datei deines alten Skripts<br>oder lege selbst einen Eintrag an.</p>
        <button class="btn primary" data-action="new">＋ Neuer Eintrag</button>
        <button class="btn" data-action="import-file">Datei importieren</button>
        <button class="btn ghost" data-action="help">Anleitung</button></div>`;
      return;
    }
    if (!list.length) { main.innerHTML = `<div class="empty"><h2>Keine Treffer</h2><p>Passe Suche oder Filter an.</p></div>`; return; }

    if (ui.view === 'table') {
      main.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th></th><th>Name</th><th>Nationality</th><th>Alter</th><th>Height</th><th>Hair color</th><th>Measurements</th><th>Global Rating</th><th>Rank</th><th>My Rating</th><th>★</th>
        </tr></thead><tbody>${list.map(e => `<tr data-id="${esc(e._id)}">
          <td class="thumb">${imgTag(images(e)[0], v(e, 'Name'))}</td>
          <td><strong>${esc(v(e, 'Name'))}</strong></td>
          <td>${esc(v(e, 'Nationality'))}</td>
          <td class="num">${age(e) ?? ''}</td>
          <td class="num">${esc(v(e, 'Height'))}</td>
          <td>${esc(v(e, 'Hair color'))}</td>
          <td>${esc(v(e, 'Measurements'))}</td>
          <td class="num">${esc(v(e, 'Global Rating'))}</td>
          <td class="num">${esc(v(e, 'Rank'))}</td>
          <td class="num">${esc(v(e, 'My Rating'))}</td>
          <td>${isTrue(e.Favorite) ? '<span style="color:var(--accent)">♥</span>' : ''}</td>
        </tr>`).join('')}</tbody></table></div>`;
      return;
    }

    main.innerHTML = `<div class="grid">${list.map(e => `
      <article class="card" data-id="${esc(e._id)}">
        <button class="fav-btn ${isTrue(e.Favorite) ? 'on' : ''}" data-fav="${esc(e._id)}" title="Favorit">${isTrue(e.Favorite) ? '♥' : '♡'}</button>
        <div class="img">${imgTag(images(e)[0], v(e, 'Name'))}
          <div class="badges">
            ${v(e, 'Global Rating') ? `<span class="badge rating">★ ${esc(v(e, 'Global Rating'))}</span>` : ''}
            ${v(e, 'Rank') ? `<span class="badge">#${esc(v(e, 'Rank'))}</span>` : ''}
            ${v(e, 'My Rating') ? `<span class="badge mine">♥ ${esc(v(e, 'My Rating'))}</span>` : ''}
          </div>
        </div>
        <div class="body">
          <div class="name">${esc(v(e, 'Name'))}</div>
          <div class="meta">${esc(metaLine(e)) || '&nbsp;'}</div>
        </div>
      </article>`).join('')}</div>`;
  }

  // ---------- Modal ----------
  const overlay = $('#overlay'), modal = $('#modal');
  let dirty = false;
  function openModal(html) { modal.innerHTML = html; overlay.hidden = false; document.body.style.overflow = 'hidden'; overlay.scrollTop = 0; dirty = false; }
  function closeModal(force) {
    if (!force && dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    overlay.hidden = true; modal.innerHTML = ''; document.body.style.overflow = ''; dirty = false;
  }
  const byId = (id) => entries.find(e => e._id === id);

  function fmtValue(e, f) {
    const val = v(e, f);
    if (!val) return '';
    if (f === 'Born') return fmtDate(val, isTrue(e['Exact Birthdate'])) + (age(e) !== null && !v(e, 'Died') ? ` (${age(e)} Jahre)` : '');
    if (f === 'Died') return fmtDate(val, true) + (age(e) !== null ? ` (mit ${age(e)})` : '');
    if (TYPES[f] === 'date') return fmtDate(val, true);
    if (TYPES[f] === 'bool') return isTrue(val) ? 'Ja' : 'Nein';
    return val + (UNITS[f] || '');
  }

  function linkLabel(f, url) {
    if (f === 'Profile URL') return 'Babepedia';
    if (f === 'Boobpedia Link') return 'Boobpedia';
    return f.replace(/ URL$/, '');
  }

  function showDetail(id) {
    const e = byId(id); if (!e) return;
    const imgs = images(e);
    const skip = new Set(['Name', 'AKA', 'Exact Birthdate', 'Favorite', 'Tags', 'Notes', 'Profile URL']);
    const sec = (title, fields) => {
      const rows = fields.filter(f => !skip.has(f)).map(f => [f, fmtValue(e, f)]).filter(([, x]) => x !== '');
      if (!rows.length) return '';
      return `<div class="sec"><h3>${title}</h3><dl class="kv">${rows.map(([f, x]) => `<div><dt>${esc(f)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl></div>`;
    };
    const links = ['Profile URL', ...LINK_FIELDS].filter(f => /^https?:\/\//i.test(v(e, f)));
    const galleries = splitList(e['Gallery Links']).filter(u => /^https?:\/\//i.test(u));
    const tags = splitList(e.Tags);

    openModal(`
      <div class="modal-head">
        <h2>${esc(v(e, 'Name'))}</h2>
        <div class="actions">
          <button class="btn small" data-action="edit" data-id="${esc(e._id)}">Bearbeiten</button>
          <button class="btn small danger" data-action="delete" data-id="${esc(e._id)}">Löschen</button>
          <button class="x" data-action="close" aria-label="Schließen">×</button>
        </div>
      </div>
      <div class="detail">
        <div class="gallery">
          <div class="main">${imgTag(imgs[0], v(e, 'Name'))}</div>
          ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="${i === 0 ? 'on' : ''}" data-thumb="${esc(u)}">`).join('')}</div>` : ''}
        </div>
        <div>
          <h1 class="d-title">${esc(v(e, 'Name'))}</h1>
          ${v(e, 'AKA') ? `<div class="d-aka">auch: ${esc(v(e, 'AKA'))}</div>` : ''}
          <div class="chips">
            <button class="chip accent" data-fav="${esc(e._id)}" style="cursor:pointer">${isTrue(e.Favorite) ? '♥ Favorit' : '♡ Als Favorit'}</button>
            ${v(e, 'My Rating') ? `<span class="chip accent">Meine Bewertung: ${esc(v(e, 'My Rating'))}/10</span>` : ''}
            ${v(e, 'Global Rating') ? `<span class="chip">★ ${esc(v(e, 'Global Rating'))}${v(e, 'Votes') ? ` (${esc(v(e, 'Votes'))} Votes)` : ''}</span>` : ''}
            ${v(e, 'Rank') ? `<span class="chip">Rank #${esc(v(e, 'Rank'))}</span>` : ''}
            ${v(e, 'Active') ? `<span class="chip">${isTrue(e.Active) ? 'aktiv' : 'inaktiv'}</span>` : ''}
            ${tags.map(t => `<button class="chip tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}
          </div>
          ${v(e, 'Notes') ? `<div class="sec"><h3>Notizen</h3><div class="notes">${esc(v(e, 'Notes'))}</div></div>` : ''}
          ${sec('Allgemein', GROUPS[0].fields)}
          ${sec('Aussehen', GROUPS[1].fields)}
          ${sec('Babepedia', GROUPS[3].fields)}
          ${links.length ? `<div class="sec"><h3>Links</h3><div class="links">${links.map(f => `<a href="${esc(v(e, f))}" target="_blank" rel="noopener noreferrer">${esc(linkLabel(f))}</a>`).join('')}</div></div>` : ''}
          ${galleries.length ? `<div class="sec"><h3>Galerien (${galleries.length})</h3><div class="links">${galleries.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Galerie ${i + 1}</a>`).join('')}</div></div>` : ''}
        </div>
      </div>`);
  }

  function fieldInput(f, e) {
    const t = TYPES[f];
    const id = 'fld-' + ALL_FIELDS.indexOf(f);
    const val = v(e, f);
    const name = `name="${esc(f)}" id="${id}"`;
    const hint = HINTS[f] ? `<span class="hint">${esc(HINTS[f])}</span>` : '';
    if (t === 'bool') {
      return `<div class="field check"><input type="checkbox" ${name} ${isTrue(val) ? 'checked' : ''}><label for="${id}">${esc(f)}</label>${hint}</div>`;
    }
    let input;
    if (Array.isArray(t)) {
      const opts = t.includes(val) ? t : [...t, val];
      input = `<select ${name}>${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o || '–')}</option>`).join('')}</select>`;
    } else if (t === 'date') {
      input = `<input type="date" ${name} value="${esc(ddToIso(val))}">`;
    } else if (t === 'num') {
      input = `<input type="number" step="any" ${f === 'My Rating' ? 'min="0" max="10" step="0.5"' : ''} ${name} value="${esc(val)}">`;
    } else if (t === 'area') {
      input = `<textarea ${name}>${esc(val)}</textarea>`;
    } else {
      const type = /URL|Link|Website|Instagram|Twitter|TikTok|YouTube|Twitch|IMDb|OnlyFans|Fansly/.test(f) ? 'url' : 'text';
      input = `<input type="${type}" ${name} value="${esc(val)}" ${f === 'Name' ? 'required' : ''}>`;
    }
    const wide = t === 'area' || f === 'Notes' ? ' wide' : '';
    return `<div class="field${wide}"><label for="${id}">${esc(f)}${f === 'Name' ? ' *' : ''}</label>${input}${hint}</div>`;
  }

  function showForm(id) {
    const isNew = !id;
    const e = isNew ? { Tattoos: 'n/a', Piercings: 'n/a', 'Exact Birthdate': 'true', Favorite: 'false' } : byId(id);
    if (!e) return;
    const order = [GROUPS[0], GROUPS[1], GROUPS[2], GROUPS[4], GROUPS[5], GROUPS[3]];
    openModal(`
      <div class="modal-head">
        <h2>${isNew ? 'Neuer Eintrag' : esc(v(e, 'Name')) + ' bearbeiten'}</h2>
        <div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div>
      </div>
      <form class="form" id="entry-form" data-id="${esc(id || '')}" novalidate>
        ${order.map(g => `<fieldset><legend>${g.title}</legend><div class="fields">${g.fields.map(f => fieldInput(f, e)).join('')}</div></fieldset>`).join('')}
      </form>
      <div class="form-foot">
        <button class="btn" data-action="${isNew ? 'close' : 'cancel-edit'}" data-id="${esc(id || '')}">Abbrechen</button>
        <button class="btn primary" data-action="save">${isNew ? 'Anlegen' : 'Speichern'}</button>
      </div>`);
    const form = $('#entry-form');
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', (ev) => { ev.preventDefault(); saveForm(); });
    $('[name="Name"]', form).focus();
  }

  function saveForm() {
    const form = $('#entry-form');
    const id = form.dataset.id;
    const data = {};
    for (const f of ALL_FIELDS) {
      const el = form.elements.namedItem(f);
      if (!el) continue;
      if (TYPES[f] === 'bool') data[f] = el.checked ? 'true' : 'false';
      else if (TYPES[f] === 'date') data[f] = isoToDd(el.value);
      else data[f] = el.value.trim();
    }
    if (!data.Name) { toast('Bitte einen Namen eingeben.', 'err'); $('[name="Name"]', form).focus(); return; }

    const dupe = entries.find(x => x._id !== id && keyOf(x) === keyOf(data));
    if (dupe && !confirm(`Es gibt bereits einen Eintrag „${dupe.Name}“ mit derselben Profil-URL bzw. demselben Namen. Trotzdem speichern?`)) return;

    const now = Date.now();
    if (id) {
      const e = byId(id);
      Object.assign(e, data, { _updated: now });
    } else {
      entries.push({ _id: uid(), _created: now, _updated: now, ...data });
    }
    save(); refreshFilters(); render();
    dirty = false;
    const target = id || entries[entries.length - 1]._id;
    showDetail(target);
    toast(id ? 'Gespeichert.' : 'Eintrag angelegt.', 'ok');
  }

  function showHelp() {
    openModal(`
      <div class="modal-head"><h2>Anleitung</h2><div class="actions"><button class="x" data-action="close">×</button></div></div>
      <div class="help">
        <h3>Profile von Babepedia übernehmen</h3>
        <ol>
          <li>Installiere das Userscript <code>babepedia-organizer.user.js</code> in Tampermonkey.</li>
          <li>Auf einer Profilseite auf <strong>➕ Add</strong> klicken, auf einer Listenseite auf <strong>🚀 Auto Fetch All</strong>.</li>
          <li>Dieses Tool öffnen (Button <strong>🗂️ Tool öffnen</strong>) – gesammelte Profile werden automatisch übernommen.</li>
        </ol>
        <p>Bereits vorhandene Einträge werden anhand der Profil-URL erkannt und aktualisiert. Deine eigenen Felder (Favorite, My Rating, Tags, Notes) bleiben dabei erhalten.</p>
        <h3>Ohne Userscript</h3>
        <p>Über <em>Daten → Importieren</em> kannst du die CSV-Datei deines alten Skripts oder ein JSON-Backup einlesen.</p>
        <h3>Wo liegen die Daten?</h3>
        <p>Nur in diesem Browser (localStorage). Mach regelmäßig ein Backup über <em>Daten → Backup exportieren</em> – damit kannst du auch auf ein anderes Gerät umziehen.</p>
        <h3>Bilder</h3>
        <p>Bilder werden nur verlinkt, nicht gespeichert. Wenn ein Bild nicht lädt, erscheinen die Initialen. Du kannst jederzeit eigene Bild-URLs eintragen.</p>
      </div>`);
  }

  function lightbox(src) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  }

  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function toggleFav(id) {
    const e = byId(id); if (!e) return;
    e.Favorite = isTrue(e.Favorite) ? 'false' : 'true';
    e._updated = Date.now();
    save(); render();
    if (!overlay.hidden && $('.detail', modal)) showDetail(id);
  }

  // ---------- Aktionen ----------
  function action(name, el) {
    switch (name) {
      case 'new': showForm(); break;
      case 'edit': showForm(el.dataset.id); break;
      case 'cancel-edit': if (!dirty || confirm('Ungespeicherte Änderungen verwerfen?')) { dirty = false; showDetail(el.dataset.id); } break;
      case 'save': saveForm(); break;
      case 'close': closeModal(); break;
      case 'delete': {
        const e = byId(el.dataset.id);
        if (e && confirm(`„${e.Name}“ wirklich löschen?`)) {
          entries = entries.filter(x => x._id !== e._id);
          save(); refreshFilters(); closeModal(true); render();
          toast('Eintrag gelöscht.');
        }
        break;
      }
      case 'import-file': $('#file-input').click(); break;
      case 'export-json':
        download(`babe-organizer-backup-${stamp()}.json`, JSON.stringify({ app: 'bp-organizer', version: 1, exported: new Date().toISOString(), entries }, null, 1), 'application/json');
        break;
      case 'export-csv':
        if (!entries.length) { toast('Keine Einträge zum Exportieren.', 'err'); break; }
        download(`babe-organizer-${entries.length}-profile.csv`, '﻿' + toCSV(entries), 'text/csv;charset=utf-8');
        break;
      case 'help': showHelp(); break;
      case 'clear-all':
        if (entries.length && confirm(`Alle ${entries.length} Einträge löschen? Mach vorher am besten ein Backup.`) && confirm('Wirklich sicher? Das lässt sich nicht rückgängig machen.')) {
          entries = []; save(); refreshFilters(); render(); toast('Alle Einträge gelöscht.');
        }
        break;
    }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const menu = $('#menu');
    if (t.closest('#btn-menu')) { menu.hidden = !menu.hidden; return; }
    if (!t.closest('#menu')) menu.hidden = true;

    const fav = t.closest('[data-fav]');
    if (fav) { ev.stopPropagation(); toggleFav(fav.dataset.fav); return; }
    const act = t.closest('[data-action]');
    if (act) { menu.hidden = true; action(act.dataset.action, act); return; }
    const thumb = t.closest('[data-thumb]');
    if (thumb) {
      const main = $('.gallery .main', modal);
      main.innerHTML = `<img src="${esc(thumb.dataset.thumb)}" alt="" referrerpolicy="no-referrer">`;
      $$('.gallery .thumbs img', modal).forEach(i => i.classList.toggle('on', i === thumb));
      return;
    }
    if (t.closest('.gallery .main img')) { lightbox(t.src); return; }
    const tag = t.closest('[data-tag]');
    if (tag) { closeModal(true); $('#q').value = tag.dataset.tag; render(); return; }
    const card = t.closest('[data-id].card, tr[data-id]');
    if (card) { showDetail(card.dataset.id); return; }
    if (t === overlay) closeModal();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const lb = $('.lightbox'); if (lb) { lb.remove(); return; }
      if (!overlay.hidden) closeModal();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 's' && $('#entry-form')) { ev.preventDefault(); saveForm(); }
  });

  $('#btn-new').addEventListener('click', () => showForm());
  $('#file-input').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (f) handleFile(f);
    ev.target.value = '';
  });
  ['#q', '#f-nationality', '#f-hair', '#f-eyes', '#f-body', '#f-active', '#f-fav'].forEach(s => $(s).addEventListener('input', render));
  $('#sort').addEventListener('change', (ev) => { ui.sort = ev.target.value; saveUI(); render(); });
  $$('.seg button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; saveUI(); render(); }));
  $('#btn-reset').addEventListener('click', () => {
    $('#q').value = ''; Object.keys(FILTERS).forEach(id => $('#' + id).value = '');
    $('#f-active').value = ''; $('#f-fav').checked = false; render();
  });

  // Daten per Drag & Drop importieren
  document.addEventListener('dragover', (ev) => ev.preventDefault());
  document.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const f = ev.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  // Änderungen aus anderen Tabs übernehmen
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORE_KEY) { entries = load(); refreshFilters(); render(); }
  });

  refreshFilters();
  render();
  // Userscript informieren, dass das Tool bereit ist
  window.postMessage({ type: 'BP_TOOL_READY' }, location.origin);
})();

// ==UserScript==
// @name         Babepedia Batch Extractor & Auto-Fetcher (Babe Organizer)
// @namespace    http://tampermonkey.net/
// @version      14.27
// @description  Auto-fetch profile data + Safe List Moving with Multi-Page / Loop Support + Übertragung an den Babe Organizer (GitHub Pages)
// @author       Mudkip
// @match        https://www.babepedia.com/*
// @match        https://thevizce.github.io/b-organizer/*
// @match        https://web.archive.org/web/*
// @updateURL    https://raw.githubusercontent.com/TheVizce/b-organizer/main/babepedia-organizer.user.js
// @downloadURL  https://raw.githubusercontent.com/TheVizce/b-organizer/main/babepedia-organizer.user.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @connect      www.babepedia.com
// @connect      babepedia.com
// @connect      web.archive.org
// ==/UserScript==

(function() {
    'use strict';

    // Adresse des Tools (GitHub Pages)
    const TOOL_URL = 'https://thevizce.github.io/b-organizer/';

    // List IDs
    const LIST_NEU = '204346';
    const LIST_GELISTET = '157076';
    const LIST_RANKER = '172740'; // Liste aller Profile, die im Image-Ranker sind

    // ===================================================================
    // Teil 1: Läuft auf der Tool-Seite (github.io) und überträgt den Batch
    // ===================================================================
    if (location.hostname.endsWith('github.io')) {
        // Nur auf dem Babe Organizer aktiv werden
        if (!document.querySelector('meta[name="bp-organizer"]')) return;

        let sent = false;
        let sentUrls = new Set();
        const syncId = String(Date.now());
        // Bekannte Profile des Tools abfragen (für den Abgleich auf der Battle-Standings-Seite)
        const requestKnown = () => window.postMessage({ type: 'BP_KNOWN_REQ', id: syncId }, location.origin);
        window.addEventListener('blur', requestKnown); // beim Verlassen des Tabs den neuesten Stand holen

        window.addEventListener('message', (ev) => {
            if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
            const d = ev.data;

            if (d.type === 'BP_TOOL_READY') requestKnown();
            if (d.type === 'BP_KNOWN' && Array.isArray(d.slugs)) {
                GM_setValue('bp_known_organizer', { slugs: d.slugs, ids: Array.isArray(d.ids) ? d.ids : [], stale: Array.isArray(d.stale) ? d.stale : [], plan: d.plan || null, count: d.count || d.slugs.length, at: new Date().toISOString() });
            }
            if (d.type === 'BP_TOOL_READY' && !sent) {
                sent = true;
                const batch = GM_getValue('bp_batch_data', []);
                if (Array.isArray(batch) && batch.length) {
                    sentUrls = new Set(batch.map(i => i['Profile URL']));
                    window.postMessage({ type: 'BP_SYNC', id: syncId, items: batch }, location.origin);
                }
                // Ranker-Abgleich über die Babepedia-Liste gibt es nicht mehr (Verknüpfung läuft im Tool) – Reste aufräumen
                if (GM_getValue('bp_ranker_sync', null)) GM_setValue('bp_ranker_sync', null);
            }

            if (d.type === 'BP_SYNC_ACK' && d.id === syncId) {
                // Nur die übertragenen Einträge aus dem Batch entfernen (falls parallel neue dazukamen)
                const rest = GM_getValue('bp_batch_data', []).filter(i => !sentUrls.has(i['Profile URL']));
                GM_setValue('bp_batch_data', rest);
            }
        });

        // Bilder für „An Image Ranker senden“ holen (der Browser selbst darf Babepedia-Bilder nicht herunterladen)
        window.addEventListener('message', (ev) => {
            if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
            const d = ev.data;
            if (d.type === 'BP_FETCH_PING') { window.postMessage({ type: 'BP_FETCH_ACK' }, location.origin); return; }
            if (d.type !== 'BP_FETCH_IMAGE' || typeof d.url !== 'string') return;
            let host = '';
            try { host = new URL(d.url).hostname; } catch (e) {}
            const reply = (buf, mime) => window.postMessage({ type: 'BP_FETCH_RESULT', id: d.id, buf: buf || null, mime: mime || '' }, location.origin);
            if (!/(^|\.)babepedia\.com$|(^|\.)archive\.org$/.test(host)) { reply(null); return; }   // nur Babepedia und Internet Archive
            GM_xmlhttpRequest({
                method: 'GET', url: d.url, responseType: 'arraybuffer', timeout: 25000,
                headers: { Referer: 'https://www.babepedia.com/' },
                onload: (r) => {
                    const mime = ((r.responseHeaders || '').match(/content-type:\s*([^\r\n;]+)/i) || [])[1] || '';
                    if (r.status >= 200 && r.status < 300 && r.response && /^image\//i.test(mime || 'image/jpeg')) reply(r.response, mime || 'image/jpeg');
                    else reply(null);
                },
                onerror: () => reply(null), ontimeout: () => reply(null)
            });
        });

        // Für die Erkennung umbenannter Profile: wohin führt eine Babepedia-Adresse heute? (Weiterleitung + Babe ID)
        window.addEventListener('message', (ev) => {
            if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
            const d = ev.data;
            if (d.type === 'BP_RESOLVE_PING') { window.postMessage({ type: 'BP_RESOLVE_ACK' }, location.origin); return; }
            if (d.type !== 'BP_RESOLVE' || typeof d.url !== 'string') return;
            const reply = (x) => window.postMessage({ type: 'BP_RESOLVE_RESULT', id: d.id, ...x }, location.origin);
            let u;
            try { u = new URL(d.url); } catch (e) { reply({ ok: false }); return; }
            if (!/(^|\.)babepedia\.com$/.test(u.hostname) || !/^\/babe\//.test(u.pathname)) { reply({ ok: false }); return; }
            GM_xmlhttpRequest({
                method: 'GET', url: u.href, timeout: 20000,
                onload: (r) => {
                    const html = r.responseText || '';
                    const babeId = (html.match(/babeid\s*[:=]\s*['"]?(\d+)/i) || [])[1] || '';
                    const hasProfile = /id=["']babename["']/.test(html);
                    reply({ ok: r.status >= 200 && r.status < 300 && hasProfile, status: r.status, finalUrl: r.finalUrl || u.href, babeId });
                },
                onerror: () => reply({ ok: false }), ontimeout: () => reply({ ok: false })
            });
        });

        // Babepedia-Noten eintragen (Tool → „Babepedia-Noten angleichen“).
        // Von der Tool-Seite aus nimmt Babepedia keine Stimme an (Login/Cookies). Deshalb legt das Skript einen
        // Auftrag ab und öffnet einen Babepedia-Tab (?bpvote=1), der ihn abarbeitet; der Fortschritt kommt über
        // den GM-Speicher zurück ins Tool.
        let votePoll = null, voteLast = '';
        const voteSendProg = () => {
            const prog = GM_getValue('bp_vote_prog', null);
            if (!prog) { clearInterval(votePoll); votePoll = null; return; }
            const sig = prog.id + '|' + prog.results.length + '|' + (prog.current || '') + '|' + !!prog.finished;
            if (sig !== voteLast) { voteLast = sig; window.postMessage({ type: 'BP_VOTE_PROG', ...prog }, location.origin); }
        };
        const voteWatch = () => { voteLast = ''; voteSendProg(); if (!votePoll) votePoll = setInterval(voteSendProg, 800); };
        window.addEventListener('message', (ev) => {
            if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
            const d = ev.data;
            if (d.type === 'BP_VOTE_PING') { window.postMessage({ type: 'BP_VOTE_ACK', v: 3 }, location.origin); return; }
            if (d.type === 'BP_TOOL_READY' && GM_getValue('bp_vote_prog', null)) { voteWatch(); return; }   // Ergebnisse nachreichen
            if (d.type === 'BP_VOTE_STOP') { GM_setValue('bp_vote_stop', String(d.id || '')); return; }
            if (d.type === 'BP_VOTE_DONE_ACK') {
                const prog = GM_getValue('bp_vote_prog', null);
                if (prog && prog.id === d.id && prog.finished) { GM_setValue('bp_vote_prog', null); GM_setValue('bp_vote_job', null); }
                return;
            }
            if (d.type !== 'BP_VOTE_JOB' || !Array.isArray(d.items)) return;
            const items = d.items.filter(it => /^\d+$/.test(String(it.k)) && it.x >= 1 && it.x <= 10)
                .map(it => ({ _id: String(it._id || ''), k: String(it.k), x: parseInt(it.x, 10), name: String(it.name || ''), verify: !!it.verify,
                    url: /^https:\/\/www\.babepedia\.com\/babe\//.test(String(it.url || '')) ? it.url : '' }));
            GM_setValue('bp_vote_stop', '');
            GM_setValue('bp_vote_job', { id: d.id, items, at: Date.now() });
            GM_setValue('bp_vote_prog', { id: d.id, total: items.length, results: [], finished: false, current: '' });
            GM_setValue('bp_vote_launch', Date.now());
            setTimeout(() => GM_openInTab('https://www.babepedia.com/?bpvote=1', { active: true, insert: true, setParent: true }), 400);
            voteWatch();
        });

        // Falls das Tool schon geladen ist: anpingen
        window.postMessage({ type: 'BP_PING' }, location.origin);
        return;
    }

    // ===================================================================
    // Teil 2: Läuft auf babepedia.com (bzw. auf archivierten Babepedia-Profilen im Internet Archive)
    // ===================================================================

    // Internet Archive: https://web.archive.org/web/<Zeitstempel>/https://www.babepedia.com/babe/<Name>
    const ARCHIVE = (() => {
        if (location.hostname !== 'web.archive.org') return null;
        const m = location.href.match(/\/web\/(\d{8,14})[a-z_]*\/(?:https?:\/\/)?(?:www\.)?babepedia\.com(\/babe\/[^?#]+)/i);
        return m ? { ts: m[1], url: 'https://www.babepedia.com' + m[2].replace(/\/$/, '') } : false;
    })();
    if (ARCHIVE === false) return; // andere Archiv-Seite -> nichts tun

    // Babepedia-Tab zum Eintragen von Noten (vom Tool aus geöffnet, ?bpvote=1): stimmt wie die Seite selbst ab
    // Start ohne Abhängigkeit von der Adresse (Babepedia kann ?bpvote=1 wegleiten): frischer Start-Auftrag im GM-Speicher
    if (!ARCHIVE && window.top === window) {
        const vJob = GM_getValue('bp_vote_job', null), vProg = GM_getValue('bp_vote_prog', null);
        const vOpen = vJob && Array.isArray(vJob.items) && !(vProg && vProg.id === vJob.id && vProg.finished);
        const vLaunch = GM_getValue('bp_vote_launch', 0) || 0;
        if (/[?&]bpvote=1\b/.test(location.search) || (vOpen && Date.now() - vLaunch < 90000)) {
            GM_setValue('bp_vote_launch', 0);   // nur dieser eine Tab startet automatisch
            runVoteJob();
            return;
        }
        if (vOpen) {
            // Offener Auftrag (z. B. Tab zu früh geschlossen): Knopf zum Fortsetzen anbieten
            const showBtn = () => {
                const btn = document.createElement('button');
                const done = vProg && vProg.id === vJob.id ? vProg.results.length : 0;
                btn.textContent = `⭐ Noten-Auftrag fortsetzen (${done}/${vJob.items.length})`;
                btn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;padding:8px 12px;background:#00838f;color:#fff;border:0;border-radius:8px;font:13px system-ui,sans-serif;cursor:pointer';
                btn.onclick = () => { btn.remove(); runVoteJob(); };
                document.body.appendChild(btn);
            };
            if (document.body) showBtn(); else document.addEventListener('DOMContentLoaded', showBtn);
        }
    }
    async function runVoteJob() {
        try { await runVoteJobInner(); }
        catch (e) { console.error('[Noten eintragen]', e); alert('Babe Organizer – Noten eintragen: Fehler\n' + (e && e.message || e)); }
    }
    async function runVoteJobInner() {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;width:min(420px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#16161c;color:#eee;border:1px solid #00838f;border-radius:10px;padding:12px 14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 6px 30px rgba(0,0,0,.5)';
        box.innerHTML = '<b>⭐ Babepedia-Noten eintragen</b><div id="bpv-st" style="margin:6px 0"></div><button id="bpv-stop" style="padding:3px 10px">Anhalten</button><pre id="bpv-log" style="white-space:pre-wrap;margin:8px 0 0;font-size:12px;color:#bbb"></pre>';
        const mount = () => (document.body || document.documentElement).appendChild(box);
        if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
        const st = (t) => { const el = box.querySelector('#bpv-st'); if (el) el.textContent = t; };
        const log = (t) => { const el = box.querySelector('#bpv-log'); if (el) el.textContent += t + '\n'; };
        st('Warte auf den Auftrag aus dem Tool …');
        let job = GM_getValue('bp_vote_job', null);
        for (let n = 0; n < 20 && !(job && Array.isArray(job.items)); n++) { await new Promise(r => setTimeout(r, 250)); job = GM_getValue('bp_vote_job', null); }
        let prog = GM_getValue('bp_vote_prog', null);
        if (!job || !Array.isArray(job.items)) { st('Kein Auftrag vorhanden – im Tool unter Daten → „Babepedia-Noten angleichen…“ starten.'); return; }
        if (!prog || prog.id !== job.id) prog = { id: job.id, total: job.items.length, results: [], finished: false, current: '' };
        if (prog.finished) { st('Dieser Auftrag ist schon erledigt. Du kannst den Tab schließen.'); return; }
        const lock = GM_getValue('bp_vote_lock', null);
        if (lock && lock.id === job.id && Date.now() - lock.t < 5000) { st('Läuft schon in einem anderen Tab.'); return; }
        const hb = setInterval(() => GM_setValue('bp_vote_lock', { id: job.id, t: Date.now() }), 1000);
        GM_setValue('bp_vote_lock', { id: job.id, t: Date.now() });
        let stop = false;
        box.querySelector('#bpv-stop').onclick = () => { stop = true; };
        document.title = '⭐ Noten eintragen … (Babe Organizer)';
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const readRating = (html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const el = doc.querySelector('#rating-score');
            const m = el && el.textContent.match(/(\d+(?:\.\d+)?)/);
            return m ? m[1] : '';
        };
        const saveProg = () => GM_setValue('bp_vote_prog', prog);
        let reason = '';
        for (let i = prog.results.length; i < job.items.length; i++) {
            if (stop || GM_getValue('bp_vote_stop', '') === job.id) { reason = 'angehalten'; break; }
            const it = job.items[i];
            prog.current = `${i + 1}/${job.items.length}: ${it.name} → ${it.x}`; saveProg(); st(prog.current);
            const res = { _id: it._id, name: it.name, x: it.x, ok: false };
            try {
                const r = await fetch(`/ajax-vote-profile.php?x=${it.x}&k=${it.k}`, {
                    credentials: 'include', headers: { 'Accept': '*/*', 'X-Requested-With': 'XMLHttpRequest' },
                    referrer: it.url || location.href, method: 'GET', mode: 'cors'
                });
                res.status = r.status;
                res.text = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
                res.ok = r.ok;
                if (r.ok && it.verify && it.url) {
                    await wait(1200);
                    const p = await fetch(it.url, { credentials: 'include', cache: 'no-store' });
                    res.seen = p.ok ? readRating(await p.text()) : '';
                    res.verified = true;
                    if (String(parseInt(res.seen, 10)) !== String(it.x)) { res.ok = false; res.reason = `auf Babepedia steht danach ${res.seen || 'keine Note'} statt ${it.x}`; }
                }
            } catch (e) { res.reason = 'Fehler: ' + (e && e.message || e); }
            prog.results.push(res); saveProg();
            log(`${res.ok ? '✓' : '✗'} ${it.name}: ${it.x}${res.verified && res.ok ? ' (geprüft)' : ''}${res.reason ? ' – ' + res.reason : ''}`);
            if ([429, 403, 503].includes(res.status)) { reason = 'Babepedia blockt gerade (zu viele Zugriffe)'; break; }
            const okN = prog.results.filter(x => x.ok).length;
            if (prog.results.length >= 3 && okN === 0) { reason = 'die ersten drei haben nicht geklappt'; break; }
            if (i < job.items.length - 1) await wait(3000);
        }
        clearInterval(hb);
        prog.finished = true; prog.reason = reason; prog.current = ''; saveProg();
        const okN = prog.results.filter(x => x.ok).length;
        st(`Fertig: ${okN} von ${prog.total} eingetragen${reason ? ' – ' + reason : ''}. Der Tab schließt sich gleich.`);
        await wait(5000);
        window.close();
    }
    const unwrapArchive = (u) => String(u || '').replace(/^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\//i, '');
    const toArchiveImg = (u) => u ? `https://web.archive.org/web/${ARCHIVE.ts}im_/${unwrapArchive(u)}` : '';

    // Aktualisiertes Schema (ohne redundante Status-Felder bei Tattoos/Piercings)
    const FIELDS = [
        'Name', 'AKA', 'Profile URL', 'Archive URL', 'Babe ID', 'Main Image URL', 
        'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links', 'Scraped At',
        'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays',
        'Born', 'Exact Birthdate', 'Died', 'Years active', 'Active', 'Active till', 'Birthplace',
        'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Hair color',
        'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup',
        'Boobs', 'Tattoos', 'Piercings',
        // External & Social Links
        'Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch',
        'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Thronly', 'Boobpedia Link'
    ];

    // Alle Nationality-Werte von Babepedia (Advanced Search) + übliche Schreibvarianten -> Ländercode
    const NATIONALITY_CODES = {
        'afghan': 'AF', 'albanian': 'AL', 'algerian': 'DZ', 'american': 'US', 'american samoan': 'AS',
        'andorran': 'AD', 'angolan': 'AO', 'anguillian': 'AI', 'antarctic': 'AQ', 'antiguan': 'AG', 'argentine': 'AR',
        'argentinian': 'AR', 'armenian': 'AM', 'aruban': 'AW', 'australian': 'AU', 'austrian': 'AT',
        'azerbaijani': 'AZ', 'azeri': 'AZ', 'bahamian': 'BS', 'bahraini': 'BH', 'bajan': 'BB', 'bangladeshi': 'BD',
        'barbadian': 'BB', 'belarusian': 'BY', 'belgian': 'BE', 'belizean': 'BZ', 'beninese': 'BJ', 'bermudian': 'BM',
        'bhutanese': 'BT', 'bolivian': 'BO', 'bosnian': 'BA', 'botswanan': 'BW', 'bouvet islander': 'BV',
        'brazilian': 'BR', 'british': 'GB', 'british virgin islander': 'VG', 'bruneian': 'BN', 'bulgarian': 'BG',
        'burkinabe': 'BF', 'burmese': 'MM', 'burundian': 'BI', 'cambodian': 'KH', 'cameroonian': 'CM',
        'canadian': 'CA', 'cape verdean': 'CV', 'caymanian': 'KY', 'central african': 'CF', 'chadian': 'TD',
        'chilean': 'CL', 'chinese': 'CN', 'christmas islander': 'CX', 'cocos islander': 'CC', 'colombian': 'CO',
        'comorian': 'KM', 'congolese': 'CD', 'cook islander': 'CK', 'costa rican': 'CR', 'croatian': 'HR',
        'cuban': 'CU', 'curacaoan': 'CW', 'cypriot': 'CY', 'czech': 'CZ', 'czechoslovak': 'CZ', 'danish': 'DK',
        'djiboutian': 'DJ', 'dominican': 'DO', 'dominican dominica': 'DM', 'dutch': 'NL', 'dutch antillean': 'CW',
        'east timorese': 'TL', 'ecuadorian': 'EC', 'egyptian': 'EG', 'emirati': 'AE', 'english': 'GB-ENG',
        'equatorial guinean': 'GQ', 'eritrean': 'ER', 'estonian': 'EE', 'ethiopian': 'ET', 'falkland islander': 'FK',
        'faroese': 'FO', 'fijian': 'FJ', 'filipina': 'PH', 'filipino': 'PH', 'finnish': 'FI', 'french': 'FR',
        'french guianese': 'GF', 'french polynesian': 'PF', 'gabonese': 'GA', 'gambian': 'GM', 'georgian': 'GE',
        'german': 'DE', 'ghanaian': 'GH', 'gibraltarian': 'GI', 'greek': 'GR', 'greenlandic': 'GL', 'grenadian': 'GD',
        'guadeloupean': 'GP', 'guamanian': 'GU', 'guatemalan': 'GT', 'guernsey': 'GG', 'guinea-bissauan': 'GW',
        'guinean': 'GN', 'guyanese': 'GY', 'haitian': 'HT', 'heard islander': 'HM', 'honduran': 'HN',
        'hong konger': 'HK', 'hongkonger': 'HK', 'hungarian': 'HU', 'i-kiribati': 'KI', 'icelandic': 'IS',
        'indian': 'IN', 'indonesian': 'ID', 'iranian': 'IR', 'iraqi': 'IQ', 'irish': 'IE', 'israeli': 'IL',
        'italian': 'IT', 'ivorian': 'CI', 'ivory coast': 'CI', 'jamaican': 'JM', 'japanese': 'JP', 'jersey': 'JE',
        'jordanian': 'JO', 'kazakh': 'KZ', 'kazakhstani': 'KZ', 'kenyan': 'KE', 'kittitian': 'KN', 'kiwi': 'NZ',
        'korean': 'KR', 'kosovar': 'XK', 'kuwaiti': 'KW', 'kyrgyz': 'KG', 'kyrgyzstani': 'KG', 'lao': 'LA',
        'laotian': 'LA', 'latvian': 'LV', 'lebanese': 'LB', 'liberian': 'LR', 'libyan': 'LY', 'liechtensteiner': 'LI',
        'lithuanian': 'LT', 'luxembourger': 'LU', 'luxembourgish': 'LU', 'macanese': 'MO', 'macedonian': 'MK',
        'mahoran': 'YT', 'malagasy': 'MG', 'malawian': 'MW', 'malaysian': 'MY', 'maldivian': 'MV', 'malian': 'ML',
        'maltese': 'MT', 'manx': 'IM', 'marshallese': 'MH', 'martiniquais': 'MQ', 'mauritanian': 'MR',
        'mauritian': 'MU', 'mexican': 'MX', 'micronesian': 'FM', 'moldovan': 'MD', 'monacan': 'MC',
        'monegasque': 'MC', 'mongolian': 'MN', 'montenegrin': 'ME', 'montserratian': 'MS', 'moroccan': 'MA',
        'mosotho': 'LS', 'motswana': 'BW', 'mozambican': 'MZ', 'namibian': 'NA', 'nauruan': 'NR', 'nepalese': 'NP',
        'nepali': 'NP', 'new caledonian': 'NC', 'new zealand': 'NZ', 'new zealander': 'NZ', 'ni-vanuatu': 'VU',
        'nicaraguan': 'NI', 'nigerian': 'NG', 'nigerien': 'NE', 'niuean': 'NU', 'norfolk islander': 'NF',
        'north korean': 'KP', 'north macedonian': 'MK', 'northern irish': 'GB', 'northern mariana islander': 'MP',
        'norwegian': 'NO', 'omani': 'OM', 'pakistani': 'PK', 'palauan': 'PW', 'palestinian': 'PS', 'panamanian': 'PA',
        'papua new guinean': 'PG', 'paraguayan': 'PY', 'persian': 'IR', 'peruvian': 'PE', 'pitcairn islander': 'PN',
        'polish': 'PL', 'portuguese': 'PT', 'puerto rican': 'PR', 'qatari': 'QA', 'reunionese': 'RE',
        'romanian': 'RO', 'russian': 'RU', 'rwandan': 'RW', 'sahrawi': 'EH', 'saint helenian': 'SH',
        'saint lucian': 'LC', 'saint vincentian': 'VC', 'saint-pierrais': 'PM', 'salvadoran': 'SV',
        'salvadorian': 'SV', 'sammarinese': 'SM', 'samoan': 'WS', 'sao tomean': 'ST', 'saudi': 'SA',
        'saudi arabian': 'SA', 'scottish': 'GB-SCT', 'senegalese': 'SN', 'serbian': 'RS', 'seychellois': 'SC',
        'sierra leonean': 'SL', 'singaporean': 'SG', 'slovak': 'SK', 'slovakian': 'SK', 'slovene': 'SI',
        'slovenian': 'SI', 'solomon islander': 'SB', 'somali': 'SO', 'south african': 'ZA', 'south georgian': 'GS',
        'south korean': 'KR', 'south sudanese': 'SS', 'soviet': 'RU', 'spanish': 'ES', 'sri lankan': 'LK',
        'sudanese': 'SD', 'surinamese': 'SR', 'surinamer': 'SR', 'svalbard': 'SJ', 'swazi': 'SZ', 'swedish': 'SE', 'swiss': 'CH',
        'syrian': 'SY', 'taiwanese': 'TW', 'tajik': 'TJ', 'tajikistani': 'TJ', 'tanzanian': 'TZ', 'thai': 'TH',
        'tobagonian': 'TT', 'togolese': 'TG', 'tokelauan': 'TK', 'tongan': 'TO', 'trinidadian': 'TT',
        'tunisian': 'TN', 'turkish': 'TR', 'turkmen': 'TM', 'turks and caicos islander': 'TC', 'tuvaluan': 'TV',
        'u.s. virgin islander': 'VI', 'ugandan': 'UG', 'ukrainian': 'UA', 'uruguayan': 'UY', 'uzbek': 'UZ',
        'uzbekistani': 'UZ', 'vatican': 'VA', 'venezuelan': 'VE', 'vietnamese': 'VN', 'wallisian': 'WF',
        'welsh': 'GB-WLS', 'yemeni': 'YE', 'yugoslav': 'RS', 'zambian': 'ZM', 'zimbabwean': 'ZW'
    };

    function flagFor(name) {
        const code = NATIONALITY_CODES[String(name || '').toLowerCase().trim()];
        if (!code) return '';
        if (code.startsWith('GB-')) {
            const sub = { 'GB-ENG': 'eng', 'GB-SCT': 'sct', 'GB-WLS': 'wls' }[code];
            return '\u{1F3F4}' + [...('gb' + sub)].map(c => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join('') + '\u{E007F}';
        }
        return [...code].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
    }

    // ---- Profession Category: fasst die Professions zu Bereichen zusammen ----
    // Reihenfolge = Sortierung der Bereiche. Eine Person kann in mehreren Bereichen landen.
    const PROFESSION_CATEGORIES = [
        ['Modeling', ['Adult Model', 'Beauty pageant contestant', 'Centerfold', 'Fetish Model', 'Fitness Model', 'Glamour Model', 'Gravure Idol', 'Model', 'Playboy Model', 'Plus Size Model', 'Race Queen', 'Ring Girl', 'Supermodel']],
        ['Acting & Performing', ['Actress', 'Ballet Dancer', 'Burlesque Dancer', 'Comedian', 'Cultural / Specialty Dancer', 'Music Video / Commercial Dancer', 'Showgirl', 'Stuntwoman', 'Voice Actress']],
        ['Digital Content', ['ASMR Star', 'Blogger', 'Camgirl', 'Content Creator (Non-Adult)', 'Cosplayer', 'Digital Creator', 'Gamer', 'Influencer', 'Podcaster', 'TikTok Star', 'YouTuber']],
        ['Adult Industry', ['AV Idol', 'Dominatrix', 'Escort', 'Exotic Dancer', 'Hotwife', 'MILF Porn Star', 'Porn Star', 'Stripper']],
        ['TV & Media', ['Celebrity', 'Director', 'Journalist', 'Presenter', 'Producer', 'Radio Host', 'Reality TV Star', 'Sports reporter', 'TV Host', 'Weather Girl']],
        ['Music', ['Musician', 'Musician: Country Singer', 'Musician: DJ', 'Musician: J-pop Idol', 'Musician: K-pop Idol', 'Musician: Rapper', 'Musician: Singer']],
        ['Athletics & Sports', ['Bodybuilder', 'Cheerleader', 'Fitness Trainer', 'Golf Instructor', 'Horseriding Instructor', 'Sportswoman']],
        ['Science / Health / Education', ['Cybersecurity expert', 'Dentist', 'Doctor - Physician', 'Nurse', 'Professor', 'Programmer', 'Science Communicator', 'Sex Therapist', 'Teacher', 'Veterinarian']],
        ['Business / Law / Politics', ['Activist', 'Barrister', 'Business Woman', 'Lawyer', 'Military Personnel', 'Political Commentator', 'Politician', 'Realtor', 'Royalty']],
        ['Creative & Design', ['Artist', 'Author', 'Fashion Designer', 'Graphic Designer', 'Photographer', 'Writer']],
        ['Service & Hospitality', ['Barista', 'Bartender', 'Beautician', 'Flight Attendant', 'Hairdresser', 'Hooters Girl', 'Nail Designer']],
        ['Sonstige', ['Housewife', 'Paranormal Investigator', 'Student', 'Trucker']]
    ];
    // Für Werte, die (noch) nicht in der Liste stehen: Regeln nach Wortbestandteilen
    const PROFESSION_RULES = [
        [/sportswoman|athlete|player|boxer|fighter|skater|racer|gymnast|swimmer|surfer|skier|wrestler|cyclist|runner/i, 'Athletics & Sports'],
        [/musician|singer|rapper|\bdj\b|pop idol|band/i, 'Music'],
        [/scientist|engineer|doctor|physician|biologist|researcher|veterinar|pharmacist|psycholog|paramedic|midwife/i, 'Science / Health / Education'],
        [/porn|adult (film|actress)|onlyfans/i, 'Adult Industry'],
        [/hairdresser|hair ?stylist|barber|waitress|stewardess/i, 'Service & Hospitality'],
        [/model/i, 'Modeling'],
        [/dancer|actress|performer/i, 'Acting & Performing'],
        [/host|reporter|presenter|anchor/i, 'TV & Media'],
        [/creator|streamer|youtuber|instagram|tiktok/i, 'Digital Content'],
        [/designer|artist|painter/i, 'Creative & Design']
    ];
    const PROFESSION_INDEX = new Map();
    PROFESSION_CATEGORIES.forEach(([cat, list]) => list.forEach(p => PROFESSION_INDEX.set(normProfession(p), cat)));

    function normProfession(p) {
        return String(p || '').toLowerCase().replace(/\(former\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function professionCategory(p) {
        const n = normProfession(p);
        if (!n) return '';
        if (PROFESSION_INDEX.has(n)) return PROFESSION_INDEX.get(n);
        if (/^sportswoman/.test(n)) return 'Athletics & Sports';
        if (/^musician/.test(n)) return 'Music';
        if (/^scientist/.test(n)) return 'Science / Health / Education';
        for (const [re, cat] of PROFESSION_RULES) if (re.test(p)) return cat;
        return 'Sonstige';
    }
    // "Actress, Model, Sportswoman: Surfer" -> "Modeling, Acting & Performing, Athletics & Sports"
    function professionCategories(professions) {
        const parts = String(professions || '').split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
        const cats = new Set(parts.map(professionCategory).filter(Boolean));
        const order = PROFESSION_CATEGORIES.map(c => c[0]);
        return [...cats].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', ');
    }

    const MIN_DELAY_MS = 2000;
    const MAX_DELAY_MS = 3500;

    GM_addStyle(`
        .bp-btn-container {
            position: fixed;
            top: 450px;
            left: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: sans-serif;
        }
        .bp-btn {
            width: 170px;
            padding: 9px 12px;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: all 0.2s ease-in-out;
            text-align: center;
        }
        #bp-add-btn { background-color: #2b5c8f; }
        #bp-add-btn:hover { background-color: #1d3e61; }
        #bp-autofetch-btn { background-color: #e65100; }
        #bp-autofetch-btn:hover { background-color: #b23c00; }
        #bp-tool-btn { background-color: #ad3a63; }
        #bp-tool-btn:hover { background-color: #7d2747; }
        #bp-update-btn { background-color: #00838f; }
        #bp-update-btn:hover { background-color: #005662; }
        #bp-update-btn.due { box-shadow: 0 0 0 2px #ffcc80; animation: bpPulse 2s ease-in-out 3; }
        @keyframes bpPulse { 50% { box-shadow: 0 0 0 5px rgba(255,204,128,.35); } }
        #bp-failed-btn { background-color: #8d6e00; }
        #bp-failed-btn:hover { background-color: #5f4a00; }
        #bp-ranker-btn { background-color: #b8860b; }
        #bp-ranker-btn:hover { background-color: #8a6508; }
        #bp-remember-btn, #bp-newlinks-btn { background-color: #1565c0; }
        #bp-remember-btn:hover, #bp-newlinks-btn:hover { background-color: #0d47a1; }
        #bp-alllinks-btn { background-color: #455a64; }
        #bp-alllinks-btn:hover { background-color: #263238; }
    `);

    function extractBabeId(doc) {
        const rankGraphLink = doc.querySelector('a[href*="/rankinggraph/"]');
        if (rankGraphLink) {
            const idMatch = rankGraphLink.href.match(/\/rankinggraph\/(\d+)/);
            if (idMatch) return idMatch[1];
        }

        const babeInput = doc.querySelector('input[name="babeid"], input[id="babeid"]');
        if (babeInput && babeInput.value) {
            return babeInput.value;
        }

        const rawHtml = doc.documentElement.innerHTML;
        const fnMatch = rawHtml.match(/(?:addto_list|fav_add|babeid\s*[:=])\s*\(?['"]?(\d+)['"]?/i);
        if (fnMatch) {
            return fnMatch[1];
        }

        const clickableEls = doc.querySelectorAll('[onclick*="addto_list"], [onclick*="fav_add"], a[href*="babeid="]');
        for (const el of clickableEls) {
            const attrVal = el.getAttribute('onclick') || el.getAttribute('href') || '';
            const match = attrVal.match(/(\d+)/);
            if (match) return match[1];
        }

        return '';
    }

    let lastFinalUrl = '';
    async function fetchWithRetry(url, options = {}, retries = 5, initialDelay = 3000) {
        let delay = initialDelay;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const res = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: options.method || "GET",
                        url: url,
                        headers: options.headers || {},
                        data: options.data || null,
                        timeout: 15000,
                        onload: (r) => resolve(r),
                        ontimeout: () => reject(new Error('Timeout')),
                        onerror: (err) => reject(err)
                    });
                });

                if (res.status === 429 || res.status === 503) {
                    const ra = (res.responseHeaders || '').match(/retry-after:\s*(\d+)/i);
                    const wait = ra ? Math.max(parseInt(ra[1], 10) * 1000, delay) : delay;
                    console.warn(`[${res.status}] Warte ${wait}ms vor Versuch ${attempt}/${retries}... (${url})`);
                    await new Promise(r => setTimeout(r, wait));
                    delay = Math.min(delay * 2, 60000);
                    if (attempt === retries) throw new Error(`HTTP ${res.status} (zu viele Anfragen)`);
                    continue;
                }

                if (res.status === 404 || res.status === 410) {
                    // Seite gibt es nicht (mehr) – nicht wiederholen
                    const e404 = new Error(`HTTP ${res.status}`); e404.gone = true; throw e404;
                }
                if (res.status < 200 || res.status >= 300) {
                    throw new Error(`HTTP ${res.status}`);
                }
                lastFinalUrl = res.finalUrl || url;
                return res.responseText;
            } catch (err) {
                if (err && err.gone) throw err;
                console.warn(`[Fetch Retry] Versuch ${attempt} für ${url} fehlgeschlagen.`, err.message);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                } else {
                    throw err;
                }
            }
        }
        throw new Error(`Maximale Versuche für ${url} erreicht.`);
    }

    // Fügt hinzu bzw. entfernt – und prüft die Antwort von Babepedia ({"success":"true"} oder Fehlermeldung).
    // Wirft einen Fehler, wenn Babepedia den Vorgang nicht bestätigt.
    async function updateBabeList(babeId, listId, action) {
        if (!babeId) throw new Error("Keine Babe ID angegeben");
        const endpoint = action === 'add' ? '/ajax-addto-list.php' : '/ajax-removefrom-list.php';

        const text = await fetchWithRetry(`https://www.babepedia.com${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
            data: `babeid=${encodeURIComponent(babeId)}&listid=${encodeURIComponent(listId)}`
        });

        let res = null;
        try { res = JSON.parse(text); } catch (e) { /* keine JSON-Antwort */ }
        if (res && (res.success === true || String(res.success).toLowerCase() === 'true')) return true;

        const msg = res && res.message ? String(res.message) : String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        // "Schon in der Liste" bzw. "nicht (mehr) in der Liste" ist für uns kein Fehler
        if (action === 'add' && /already/i.test(msg)) return true;
        if (action === 'remove' && /not (in|on|found)|already removed|doesn.t exist/i.test(msg)) return true;
        throw new Error(`${action === 'add' ? 'Hinzufügen zu' : 'Entfernen aus'} Liste ${listId} nicht bestätigt: ${msg || 'leere Antwort'}`);
    }

    // Erkennt anhand der Adresse, ob du gerade die NEU- oder die GELISTET-Liste ansiehst
    function getListContext() {
        const url = location.href;
        const hasId = (id) => new RegExp(`(^|[^0-9])${id}([^0-9]|$)`).test(url);
        if (hasId(LIST_RANKER)) return 'ranker';
        if (hasId(LIST_GELISTET)) return 'gelistet';
        if (hasId(LIST_NEU)) return 'neu';
        if (/\/babe\//i.test(location.pathname)) return 'profil';
        return 'andere';
    }

    // Für Listenseiten: sollen die geholten Profile von NEU nach GELISTET verschoben werden?
    function shouldMoveForThisPage() {
        const ctx = getListContext();
        if (ctx === 'neu') return true;
        if (ctx === 'gelistet' || ctx === 'ranker') return false;
        return confirm('Diese Seite ist weder deine NEU- noch deine GELISTET-Liste.\n\n[OK] = Geholte Profile in GELISTET aufnehmen (und aus NEU entfernen)\n[Abbrechen] = Listen nicht verändern');
    }

    // Erst in GELISTET aufnehmen; nur wenn Babepedia das bestätigt, aus NEU entfernen.
    async function safeMoveBabeBetweenLists(babeId, fromListId = LIST_NEU, toListId = LIST_GELISTET) {
        if (!babeId) throw new Error('Keine Babe ID gefunden – Profil bleibt in NEU');
        if (toListId) {
            await updateBabeList(babeId, toListId, 'add');   // wirft bei Fehler -> kein Entfernen
        }
        if (fromListId) {
            await updateBabeList(babeId, fromListId, 'remove');
        }
    }

    function parseBirthdate(text) {
        if (!text) return { date: '', exact: 'false' };
        
        const monthNames = {
            "january": "01", "february": "02", "march": "03", "april": "04",
            "may": "05", "june": "06", "july": "07", "august": "08",
            "september": "09", "october": "10", "november": "11", "december": "12"
        };
        
        const fullMatch = text.match(/(\d+)(?:st|nd|rd|th)?\s+of\s+([a-zA-Z]+)\s+(\d{4})/i);
        if (fullMatch) {
            const day = fullMatch[1].padStart(2, '0');
            const month = monthNames[fullMatch[2].toLowerCase()] || '00';
            const year = fullMatch[3];
            return { date: `${day}${month}${year}`, exact: 'true' };
        }

        const yearOnlyMatch = text.match(/\b(\d{4})\b/);
        if (yearOnlyMatch) {
            return { date: `0101${yearOnlyMatch[1]}`, exact: 'false' };
        }

        return { date: text, exact: 'false' };
    }

    function parseDateToDDMMYYYY(text) {
        return parseBirthdate(text).date;
    }

    function getTodayDDMMYYYY() {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}${month}${year}`;
    }

    function cleanImageUrl(url) {
        if (!url) return '';
        return url
            .replace('/user-uploads-thumbs/', '/user-uploads/')
            .replace(/_thumb\d*\.jpg$/i, '.jpg');
    }

    function formatNationalityWithFlags(rawText) {
        if (!rawText) return '';
        const parts = rawText.split(/[,/&]+|\s+and\s+/i);
        const formatted = parts.map(part => {
            let cleanPart = part.replace(/[()]/g, '').trim();
            if (!cleanPart) return '';
            let lower = cleanPart.toLowerCase();
            let flag = flagFor(lower);
            return flag ? `${flag} ${cleanPart}` : cleanPart;
        }).filter(Boolean);

        return formatted.join(', ');
    }

    // --- NEU v12.2: Säuberung & Zuordnung für Boobs ---
    function normalizeBoobs(val) {
        if (!val) return '';
        const lower = val.toLowerCase();

        if (lower.includes('removed implants') || lower.includes('removed')) {
            return 'Real (Removed implants)';
        }
        if (lower.includes('fake') || lower.includes('enhanced') || lower.includes('implants')) {
            return 'Fake/Enhanced';
        }
        if (lower.includes('real') || lower.includes('natural')) {
            return 'Real/Natural';
        }
        if (lower.includes('unknown')) {
            return 'Unknown';
        }

        return '';
    }

    async function parseProfileFromDoc(doc, targetUrl) {
        const data = {};

        const profileUrl = targetUrl || window.location.href;
        data['Profile URL'] = profileUrl;
        data['Scraped At'] = getTodayDDMMYYYY();

        let babeSlug = '';
        const slugMatch = profileUrl.match(/\/babe\/([^/?#]+)/i);
        if (slugMatch) {
            babeSlug = slugMatch[1];
        }

        let babeId = extractBabeId(doc);

        // Nur echte Bilddateien übernehmen. Ohne Foto zeigt Babepedia hier "noimg"-Links auf /uploadphotos/...
        const isImgUrl = (u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(String(u || ''));
        const absImg = (u) => { try { return new URL(u, 'https://www.babepedia.com').href; } catch (e) { return ''; } };

        const mainImgEl = doc.querySelector('#profimg img, .profile-pic img, #bio-img img');
        const mainSrc = mainImgEl ? absImg(mainImgEl.getAttribute('src') || mainImgEl.getAttribute('data-src') || '') : '';
        data['Main Image URL'] = isImgUrl(mainSrc) ? cleanImageUrl(mainSrc) : '';

        const profSelect = [...doc.querySelectorAll('#profselect a.img:not(.noimg)')]
            .map(a => absImg(a.getAttribute('href') || ''))
            .filter(isImgUrl)
            .map(cleanImageUrl);
        data['Image 2 URL'] = profSelect[0] || '';
        data['Image 3 URL'] = profSelect[1] || '';
        data['Image 4 URL'] = profSelect[2] || '';

        const galleryUrls = new Set();
        const absUrl = (u) => { try { return new URL(u, 'https://www.babepedia.com').href; } catch (e) { return ''; } };
        doc.querySelectorAll('.useruploads2 a[href], .useruploads2 img').forEach(el => {
            // Bevorzugt den Link aufs große Bild, sonst data-src/src des (lazy) Vorschaubilds
            let raw = el.tagName === 'A'
                ? el.getAttribute('href')
                : (el.closest('a[href]') ? '' : (el.getAttribute('data-src') || el.getAttribute('src') || ''));
            if (!raw || !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(raw)) return;
            const src = absUrl(raw);
            if (src && !src.includes('badge') && !src.includes('icon')) {
                const hdUrl = cleanImageUrl(src);
                if (hdUrl !== data['Main Image URL'] && 
                    hdUrl !== data['Image 2 URL'] && 
                    hdUrl !== data['Image 3 URL'] && 
                    hdUrl !== data['Image 4 URL']) {
                    galleryUrls.add(hdUrl);
                }
            }
        });
        data['User Upload Image URLs'] = Array.from(galleryUrls).join(', ');

        const galleryLinks = new Set();
        const allAnchors = doc.querySelectorAll('a[href]');
        
        const galleryRegex = babeSlug 
            ? new RegExp(`^https?:\\/\\/(?:www\\.)?babepedia\\.com\\/gallery\\/${babeSlug.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\/\\d+`, 'i')
            : /^https?:\/\/(?:www\.)?babepedia\.com\/gallery\/[^\/]+\/\d+/i;

        allAnchors.forEach(a => {
            const href = a.getAttribute('href') || a.href || '';
            if (href) {
                const fullHref = href.startsWith('/') ? `https://www.babepedia.com${href}` : href;
                if (galleryRegex.test(fullHref)) {
                    const cleanLink = fullHref.split('?')[0].split('#')[0];
                    galleryLinks.add(cleanLink);
                }
            }
        });
        data['Gallery Links'] = Array.from(galleryLinks).join(', ');

        const nameEl = doc.querySelector('#babename');
        data['Name'] = nameEl ? nameEl.innerText.trim() : '';

        const akaEl = doc.querySelector('#aka');
        data['AKA'] = akaEl ? akaEl.innerText.replace(/Also known as:/i, '').trim() : '';

        data['Global Rating'] = '';
        const globalRatingEl = doc.querySelector('.rating-global strong');
        if (globalRatingEl && !globalRatingEl.innerText.includes('-/10')) {
            const match = globalRatingEl.innerText.match(/(\d+(?:\.\d+)?)/);
            if (match) data['Global Rating'] = match[1];
        }

        data['Votes'] = '';
        const globalSmallEls = doc.querySelectorAll('.rating-global small');
        globalSmallEls.forEach(el => {
            if (el.innerText.includes('votes')) {
                const match = el.innerText.match(/(\d+)/);
                if (match) data['Votes'] = match[1];
            }
        });

        data['User Rating'] = '';
        const userRatingEl = doc.querySelector('#rating-score');
        if (userRatingEl) {
            const match = userRatingEl.innerText.match(/(\d+(?:\.\d+)?)/);
            if (match) data['User Rating'] = match[1];
        }

        data['Rank'] = '';
        const rankEl = doc.querySelector('.rating-rank div');
        if (rankEl && !rankEl.innerText.toLowerCase().includes('n/a')) {
            const match = rankEl.innerText.match(/(\d+)/);
            if (match) data['Rank'] = match[1];
        }
        // Babepedia zeigt bei manchen Profilen „Rank 0“ (Fehler auf der Seite) → aus der Ranking-Grafik holen
        const rankBroken = data['Rank'] === '0';
        if (rankBroken) data['Rank'] = '';

        data['Highest Rank'] = '';
        data['Peakdays'] = '';
        const highestRankEl = doc.querySelector('.rating-rank small');
        if (highestRankEl && highestRankEl.innerText.trim() !== '') {
            const match = highestRankEl.innerText.match(/(\d+)/);
            if (match && match[1] !== '0') data['Highest Rank'] = match[1];

            const peakLink = highestRankEl.querySelector('a[href*="numberonetop100"]');
            if (peakLink) {
                const dayMatch = peakLink.innerText.match(/#1\s+for\s+(\d+)\s+day/i);
                if (dayMatch) data['Peakdays'] = dayMatch[1];
            }
        }

        if ((!data['Highest Rank'] || rankBroken) && !ARCHIVE) {
            const rankingGraphAnchor = doc.querySelector('.rating-rank a[href*="/rankinggraph/"]');
            if (rankingGraphAnchor || (rankBroken && babeId)) {
                // ohne Link auf der Seite (nur bei „Rank 0“): Ranking-Grafik direkt über die Babe ID
                let rankGraphHref = rankingGraphAnchor ? (rankingGraphAnchor.getAttribute('href') || rankingGraphAnchor.href || '') : `/rankinggraph/${babeId}`;
                if (rankGraphHref) {
                    const fullRankUrl = rankGraphHref.startsWith('/') ? `https://www.babepedia.com${rankGraphHref}` : rankGraphHref;
                    try {
                        const rankHtml = await fetchWithRetry(fullRankUrl, {}, 2);
                        const matchHighest = rankHtml.match(/Highest rank:\s*#?(\d+)/i);
                        if (matchHighest && matchHighest[1] !== '0' && !data['Highest Rank']) {
                            data['Highest Rank'] = matchHighest[1];
                        }
                        const matchCurrent = rankHtml.replace(/<[^>]+>/g, ' ').match(/Current rank\s*:?\s*#?\s*([\d.,]+)/i);
                        if (rankBroken && matchCurrent) {
                            const r = matchCurrent[1].replace(/[.,]/g, '');
                            if (r && r !== '0') data['Rank'] = r;
                        }
                    } catch (e) {
                        console.warn(`[RankingGraph Fallback] Fehler bei ${fullRankUrl}:`, e);
                    }
                }
            }
        }

        // Standardwerte für Tattoos, Piercings & Birthdate
        data['Tattoos'] = 'n/a';
        data['Piercings'] = 'n/a';
        data['Exact Birthdate'] = 'false';
        data['Boobs'] = '';

        const infoItems = doc.querySelectorAll('.info-grid .info-item');
        infoItems.forEach(item => {
            if (item.classList.contains('info-title')) return;
            const labelEl = item.querySelector('.label');
            const valueEl = item.querySelector('.value');

            if (labelEl && valueEl) {
                const label = labelEl.innerText.replace(':', '').trim();
                let valNode = valueEl.cloneNode(true);
                valNode.querySelectorAll('script, style, #showcupconversions, .countryrank, span[id^="cupconversions"]').forEach(e => e.remove());
                let value = valNode.innerText.replace(/\s+/g, ' ').trim();

                if (label === 'Born') {
                    const parsed = parseBirthdate(value);
                    data['Born'] = parsed.date;
                    data['Exact Birthdate'] = parsed.exact;
                } else if (label === 'Died') {
                    data['Died'] = parseDateToDDMMYYYY(value);
                } else if (label === 'Years active') {
                    const match = value.match(/(\d{4})\s*-\s*(present|\d{4})/i);
                    if (match) {
                        data['Years active'] = match[1];
                        if (match[2].toLowerCase() === 'present') {
                            data['Active'] = 'true';
                            data['Active till'] = '';
                        } else {
                            data['Active'] = 'false';
                            data['Active till'] = match[2];
                        }
                    } else {
                        const singleYear = value.match(/(\d{4})/);
                        if (singleYear) data['Years active'] = singleYear[1];
                    }
                } else if (label === 'Nationality') {
                    data['Nationality'] = formatNationalityWithFlags(value);
                } else if (label === 'Professions') {
                    let profs = value.replace(/\(former\)/gi, '')
                                     .split(',')
                                     .map(s => s.trim())
                                     .filter(Boolean)
                                     .join(', ');
                    data['Professions'] = profs;
                    data['Profession Category'] = professionCategories(profs);
                } else if (label === 'Height') {
                    const match = value.match(/(\d+)\s*cm/i);
                    if (match) data['Height'] = match[1];
                } else if (label === 'Weight') {
                    const match = value.match(/(\d+)\s*kg/i);
                    if (match) data['Weight'] = match[1];
                } else if (label === 'Measurements') {
                    // Immer in cm speichern. Babepedia zeigt je nach Kontoeinstellung "36–24–36 in" oder cm.
                    // Unbekannte Werte stehen auf Babepedia als „?“ (z. B. „?–68.6–81.3 cm (B–W–H) · WHR 0.84“)
                    const triple = /(\d+(?:\.\d+)?|\?)\s*[\-–—]\s*(\d+(?:\.\d+)?|\?)\s*[\-–—]\s*(\d+(?:\.\d+)?|\?)\s*(cm|in(?:ch(?:es)?)?\b|["″])?/gi;
                    const all = [...value.matchAll(triple)];
                    const cmHit = all.find(m => m[4] && m[4].toLowerCase() === 'cm');
                    const match = cmHit || all[0];
                    if (match) {
                        const firstNum = [match[1], match[2], match[3]].find(x => x !== '?');
                        const isInch = !cmHit && (/^(in|inch|inches|"|″)$/i.test(match[4] || '') || (match[1] !== '?' && parseFloat(match[1]) < 60) || (match[1] === '?' && parseFloat(firstNum) < 45));
                        const f = isInch ? 2.54 : 1;
                        const [bust, waist, hips] = [match[1], match[2], match[3]].map(x => x === '?' ? '?' : Math.round(parseFloat(x) * f));
                        data['Measurements'] = [bust, waist, hips].every(x => x === '?') ? '' : `${bust}-${waist}-${hips}`;
                    } else {
                        data['Measurements'] = value;
                    }
                } else if (label === 'Bra/cup size') {
                    // „34DD“ → DD; „F (32F US / 70H JP)“ → F; Zusätze in Klammern weglassen
                    const cupMatch = value.match(/^[0-9]+\s*([A-Za-z]+)/) || value.match(/^([A-Z]{1,3})(?![a-z])/);
                    if (cupMatch) data['Bra/Cup'] = cupMatch[1];
                    else data['Bra/Cup'] = value;
                } else if (label === 'Boobs') {
                    // NEU: Verwende vereinheitlichte Begriffe
                    data['Boobs'] = normalizeBoobs(value);
                } else if (label === 'Tattoos') {
                    // NEU: Ja / Nein / n/a
                    if (value.toLowerCase() === 'none') {
                        data['Tattoos'] = 'Nein';
                    } else if (value !== '') {
                        data['Tattoos'] = 'Ja';
                    }
                } else if (label === 'Piercings') {
                    // NEU: Ja / Nein / n/a
                    if (value.toLowerCase() === 'none') {
                        data['Piercings'] = 'Nein';
                    } else if (value !== '') {
                        data['Piercings'] = 'Ja';
                    }
                } else if (['Birthplace', 'Ethnicity', 'Sexuality', 'Hair color', 'Eye color', 'Body type'].includes(label)) {
                    data[label] = value;
                }
            }
        });

        const socialContainer = doc.querySelector('#socialicons');
        if (socialContainer) {
            const officialWebEl = socialContainer.querySelector('a.proficon.www, a[title*="Official"]');
            if (officialWebEl) data['Website'] = officialWebEl.href;

            const xEl = socialContainer.querySelector('a.proficon.x, a.proficon.twitter, a[href*="twitter.com/"], a[href*="x.com/"]');
            if (xEl) data['X / Twitter'] = xEl.href;

            const socialLinks = socialContainer.querySelectorAll('a[href]');
            const ofLinks = [];

            socialLinks.forEach(a => {
                const href = a.href;
                if (href.includes('instagram.com/')) data['Instagram'] = href;
                else if (href.includes('tiktok.com/')) data['TikTok'] = href;
                else if (href.includes('youtube.com/') || href.includes('youtu.be/')) data['YouTube'] = href;
                else if (href.includes('twitch.tv/')) data['Twitch'] = href;
                else if (href.includes('imdb.com/')) data['IMDb'] = href;
                else if (href.includes('fansly.com/')) data['Fansly'] = href;
                else if (href.includes('thronly.com/')) data['Thronly'] = href;
                else if (href.includes('onlyfans.com/') || href.includes('babepedia.com/onlyfans/')) {
                    if (!ofLinks.includes(href)) ofLinks.push(href);
                }
            });

            if (ofLinks.length > 0) data['OnlyFans 1'] = ofLinks[0];
            if (ofLinks.length > 1) data['OnlyFans 2'] = ofLinks[1];
        }

        const tableLinks = doc.querySelectorAll('.linkstable a, div.separate a');
        tableLinks.forEach(a => {
            const href = a.href || '';
            const text = a.innerText || '';
            if (href.includes('boobpedia.com') || text.toLowerCase().includes('boobpedia')) {
                data['Boobpedia Link'] = href;
            }
        });

        if (ARCHIVE) {
            // Archiv-Kopie: Original-Adressen wiederherstellen, Bilder über das Archiv laden
            // (bei gelöschten Profilen gibt es die Originale auf Babepedia nicht mehr)
            for (const k of Object.keys(data)) {
                if (/URL|Link|Website|Instagram|Twitter|TikTok|YouTube|Twitch|IMDb|OnlyFans|Fansly|Thronly/.test(k) && typeof data[k] === 'string') {
                    data[k] = data[k].split(', ').map(unwrapArchive).join(', ');
                }
            }
            data['Profile URL'] = ARCHIVE.url;
            data['Archive URL'] = `https://web.archive.org/web/${ARCHIVE.ts}/${ARCHIVE.url}`;
            for (const k of ['Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL']) data[k] = toArchiveImg(data[k]);
            data['User Upload Image URLs'] = String(data['User Upload Image URLs'] || '').split(', ').filter(Boolean).map(toArchiveImg).join(', ');
            data['User Rating'] = ''; // eigene Bewertung ist in der Archiv-Kopie nicht enthalten
            data['Scraped At'] = ARCHIVE.ts.slice(6, 8) + ARCHIVE.ts.slice(4, 6) + ARCHIVE.ts.slice(0, 4); // Stand = Datum der Archiv-Kopie
            data.__archive = true;    // Profil kommt aus dem Archiv → auf Babepedia gelöscht (Tool setzt den Status)
        }
        data['Babe ID'] = babeId || '';
        return { profileData: data, babeId: babeId };
    }

    function getBabeLinksFromDoc(doc = document) {
        const babeLinks = new Set();
        const thumbshotEls = doc.querySelectorAll('#thumbs .thumbshot a[href*="/babe/"], #thumbs .thumbshot.rated a[href*="/babe/"], .thumbsblock .thumbshot a[href*="/babe/"], .thumbsblock .thumbshot.rated a[href*="/babe/"]');

        thumbshotEls.forEach(a => {
            if (a.href) babeLinks.add(a.href);
        });
        return Array.from(babeLinks);
    }

    // Liest die Gesamtzahl der Seiten (data-totalpages bzw. höchste Seitenzahl in den Links)
    function getTotalPages(doc = document) {
        const pag = doc.querySelector('.pagination[data-totalpages]');
        let max = pag ? parseInt(pag.getAttribute('data-totalpages'), 10) || 1 : 1;
        doc.querySelectorAll('a[href*="page="]').forEach(a => {
            const m = (a.getAttribute('href') || '').match(/[?&]page=(\d+)/i);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return max;
    }

    function getExpectedListTotal(doc = document) {
        const m = (doc.body ? doc.body.textContent : '').match(/Total number of babes in this list:\s*([\d.,]+)/i);
        return m ? parseInt(m[1].replace(/[.,]/g, ''), 10) : null;
    }

    function pageUrl(p) {
        const u = new URL(location.href);
        u.hash = '';
        if (p <= 1) u.searchParams.delete('page'); else u.searchParams.set('page', String(p));
        return u.href;
    }

    // Holt die Profil-Links ALLER Seiten – auch Seite 1, wenn man gerade auf einer späteren Seite steht.
    // Fehlgeschlagene Seiten werden am Ende ein zweites Mal versucht.
    async function getAllBabeLinksMultiPage(onProgress) {
        const links = new Set();
        const totalPages = getTotalPages(document);
        const currentPage = parseInt(new URL(location.href).searchParams.get('page') || '1', 10);
        const expected = getExpectedListTotal(document);

        getBabeLinksFromDoc(document).forEach(l => links.add(l));
        const todo = [];
        for (let p = 1; p <= totalPages; p++) if (p !== currentPage) todo.push(p);

        console.log(`[MultiPage] ${totalPages} Seiten erkannt${expected ? `, laut Liste ${expected} Einträge` : ''}.`);

        const loadPage = async (p) => {
            const html = await fetchWithRetry(pageUrl(p), {}, 5, 2000);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const found = getBabeLinksFromDoc(doc);
            if (found.length === 0) throw new Error('Keine Profile auf der Seite gefunden');
            found.forEach(l => links.add(l));
        };

        let failed = [];
        for (let i = 0; i < todo.length; i++) {
            if (onProgress) onProgress(`📄 Seite ${i + 2}/${totalPages}`);
            try { await loadPage(todo[i]); }
            catch (err) { console.warn(`[MultiPage] Seite ${todo[i]} fehlgeschlagen:`, err.message); failed.push(todo[i]); }
            await new Promise(r => setTimeout(r, getRandomDelay(900, 1500)));
        }

        if (failed.length) {
            console.log(`[MultiPage] Zweiter Versuch für ${failed.length} Seiten...`);
            await new Promise(r => setTimeout(r, 10000));
            const again = failed; failed = [];
            for (let i = 0; i < again.length; i++) {
                if (onProgress) onProgress(`🔁 Seite ${again[i]} (${i + 1}/${again.length})`);
                try { await loadPage(again[i]); }
                catch (err) { failed.push(again[i]); }
                await new Promise(r => setTimeout(r, getRandomDelay(2500, 4000)));
            }
        }

        const result = Array.from(links);
        console.log(`[MultiPage] Fertig: ${result.length} Profile auf ${totalPages - failed.length}/${totalPages} Seiten.`);
        if (failed.length || (expected && result.length < expected)) {
            alert(`Achtung: ${result.length} Profile gefunden` +
                  (expected ? `, die Liste enthält laut Babepedia ${expected}.` : '.') +
                  (failed.length ? `\nNicht ladbare Seiten: ${failed.join(', ')}` : '') +
                  `\n\nEs wird mit den gefundenen Profilen weitergemacht.`);
        }
        return result;
    }

    // Batch liegt im Tampermonkey-Speicher, damit die Tool-Seite (github.io) ihn lesen kann
    function getStoredData() {
        const data = GM_getValue('bp_batch_data', []);
        return Array.isArray(data) ? data : [];
    }

    function saveStoredData(list) {
        GM_setValue('bp_batch_data', list);
    }

    // Einmalige Übernahme eines alten Batches aus dem localStorage (Version 12.x)
    (function migrateOldBatch() {
        try {
            const old = JSON.parse(localStorage.getItem('bp_batch_data') || '[]');
            if (Array.isArray(old) && old.length) {
                const list = getStoredData();
                old.forEach(item => {
                    if (!list.some(i => i['Profile URL'] === item['Profile URL'])) list.push(item);
                });
                saveStoredData(list);
            }
            localStorage.removeItem('bp_batch_data');
        } catch (e) { /* ignorieren */ }
    })();

    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // ---- Fehlgeschlagene Profile merken und nachholen ----
    function getFailed() { const f = GM_getValue('bp_failed', []); return Array.isArray(f) ? f : []; }
    function setFailed(list) { GM_setValue('bp_failed', list); if (window.__bpUpdateFailedBtn) window.__bpUpdateFailedBtn(); }
    function markFailed(url, move, error) {
        const list = getFailed().filter(f => f.url !== url);
        list.push({ url, move: !!move, error: String(error || ''), at: new Date().toISOString() });
        setFailed(list);
    }
    function clearFailed(url) {
        const list = getFailed();
        if (list.some(f => f.url === url)) setFailed(list.filter(f => f.url !== url));
    }

    // ---- Rollierendes Update: zuletzt geholte Profile merken ----
    // Ergänzt den Stand aus dem Tool (Scraped At), falls das Tool zwischendurch nicht geöffnet wurde.
    function getFetchedRecent() { const m = GM_getValue('bp_fetched_recent', {}); return m && typeof m === 'object' ? m : {}; }
    function noteFetched(url) {
        const m = getFetchedRecent(), now = Date.now(), k = slugOfUrl(url);
        if (!k) return;
        m[k] = now;
        for (const [x, t] of Object.entries(m)) if (now - t > 120 * 864e5) delete m[x];   // nach 120 Tagen vergessen
        GM_setValue('bp_fetched_recent', m);
    }
    function pickOldest(n) {
        const org = GM_getValue('bp_known_organizer', null);
        if (!org || !Array.isArray(org.stale) || !org.stale.length) return null;
        const recent = getFetchedRecent();
        const inBatch = new Set(getStoredData().map(i => slugOfUrl(i['Profile URL'])));
        const failed = new Set(getFailed().map(f => slugOfUrl(f.url || f)));
        const orgAt = org.at ? new Date(org.at).getTime() : 0;
        const list = org.stale.map(([url, ts]) => {
            const k = slugOfUrl(url), r = recent[k] || 0;
            // Geholt, das Tool hat sich danach gemeldet und steht trotzdem noch auf dem alten Stand?
            // Dann ist die Übernahme verloren gegangen → wieder normal einreihen (Fehlschläge bleiben zurückgestellt).
            const lost = r && !failed.has(k) && !inBatch.has(k) && orgAt > r + 60000 && (ts || 0) < r - 864e5;
            const eff = inBatch.has(k) ? Date.now() : lost ? (ts || 0) : Math.max(ts || 0, r);
            return { url, toolTs: ts || 0, ts: eff, k };
        }).sort((a, b) => a.ts - b.ts);
        // Profile, die im Tool älter sind als das, was jetzt drankommt, aber zurückgestellt wurden – mit Grund
        const head = list.slice(0, n), lastTs = head.length ? head[head.length - 1].ts : 0;
        const deferred = list.filter(x => x.toolTs < x.ts && x.toolTs < lastTs);
        const why = { failed: 0, batch: 0, notImported: 0 };
        for (const x of deferred) { if (inBatch.has(x.k)) why.batch++; else if (failed.has(x.k)) why.failed++; else why.notImported++; }
        return { picked: head, total: list.length, at: org.at, deferred: deferred.length, why, oldestTool: list.reduce((m, x) => Math.min(m, x.toolTs), Infinity) };
    }

    // Am Ende eines Laufs: Fehlschläge einmal nachholen, dann anbieten, das Tool zu öffnen
    async function finishRun(title, okCount, total, failed, onProgress, goneCount = 0) {
        let retried = 0;
        if (failed.length) {
            if (onProgress) onProgress(`⏸ Pause vor 2. Versuch (${failed.length})`);
            await new Promise(r => setTimeout(r, 60000));
            for (let i = 0; i < failed.length; i++) {
                if (onProgress) onProgress(`↻ 2. Versuch ${i + 1}/${failed.length}`);
                const res = await fetchOneProfile(failed[i].url, failed[i].move);
                if (res.ok) { retried++; okCount++; }
                await new Promise(r => setTimeout(r, getRandomDelay(MIN_DELAY_MS + 1000, MAX_DELAY_MS + 2000)));
            }
        }
        const rest = failed.length - retried;
        const msg = `${title}: ${okCount} von ${total} Profilen geholt` + (retried ? ` (${retried} davon im 2. Versuch)` : '') + '.' +
            (rest ? `\n${rest} weiterhin fehlgeschlagen – später über „↻ Fehlgeschlagene“.` : '') +
            (goneCount ? `\n${goneCount} Profil(e) gibt es auf Babepedia nicht mehr – das Tool markiert sie als gelöscht.` : '');
        if ((okCount || goneCount) && confirm(msg + '\n\nJetzt ins Tool übernehmen?')) GM_openInTab(TOOL_URL, { active: true });
        else if (!okCount) alert(msg);
    }

    async function updateOldest(onProgress) {
        const orgPlan = (GM_getValue('bp_known_organizer', null) || {}).plan;
        // Vorschlag aus dem Update-Plan des Tools (fällig in den nächsten 7 Tagen, höchstens „pro Lauf“); sonst zuletzt genutzte Zahl
        const def = (orgPlan && orgPlan.recommended) || Number(GM_getValue('bp_update_n', 150)) || 150;
        const peek = pickOldest(1);
        if (!peek) { alert('Das Skript kennt den Stand des Tools noch nicht.\n\nBitte das Tool einmal öffnen (🗂️ Tool öffnen) und danach hier erneut starten.'); return; }
        const fmt = (ts) => ts ? new Date(ts).toLocaleDateString('de-DE') : 'nie';
        const full = pickOldest(def);
        const w = full.why, notes = [];
        if (w.failed) notes.push(`${w.failed} zuletzt fehlgeschlagen → „↻ Fehlgeschlagene“`);
        if (w.batch) notes.push(`${w.batch} schon geholt, warten auf Übernahme → „🗂️ Tool öffnen“`);
        if (w.notImported) notes.push(`${w.notImported} kürzlich geholt, im Tool aber noch nicht aktualisiert → Tool öffnen`);
        const planTxt = orgPlan ? `\n\nPlan (Tool): alle ${orgPlan.interval} Tage, höchstens ${orgPlan.max} pro Lauf · ${orgPlan.overdue} überfällig, ${orgPlan.soon} diese Woche fällig.` : '';
        const ans = prompt(`Rollierendes Update: Wie viele Profile holen?${planTxt}\n\nDie am längsten nicht aktualisierten zuerst (als Nächstes dran: Stand ${fmt(peek.picked[0].ts)}).\n${peek.total} Profile im Tool · Stand vom ${new Date(peek.at).toLocaleString('de-DE')}` +
            (full.deferred ? `\n\nZurückgestellt (im Tool älter, ältestes ${fmt(full.oldestTool)}):\n• ${notes.join('\n• ')}` : ''), String(def));
        if (ans === null) return;
        const n = Math.max(1, Math.min(peek.total, Math.floor(Number(ans)) || def));
        if (!orgPlan || n !== orgPlan.recommended) GM_setValue('bp_update_n', n);
        const { picked } = pickOldest(n);
        let okCount = 0, goneCount = 0; const failed = [];
        for (let i = 0; i < picked.length; i++) {
            if (onProgress) onProgress(`⏳ ${i + 1}/${picked.length} Update`);
            const res = await fetchOneProfile(picked[i].url, false);
            if (res.ok) okCount++; else if (res.gone) goneCount++; else { failed.push({ url: picked[i].url, move: false }); noteFetched(picked[i].url); }   // auch Fehlschläge rotieren weiter (z. B. gelöschte Profile)
            await new Promise(r => setTimeout(r, getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS)));
        }
        await finishRun('Update', okCount, picked.length, failed, onProgress, goneCount);
    }

    // Holt ein einzelnes Profil, legt es im Batch ab und verschiebt es ggf. in GELISTET
    async function fetchOneProfile(url, moveToListed) {
        try {
            const htmlText = await fetchWithRetry(url);
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            // Babepedia leitet gelöschte Profile teils auf eine andere Seite (Suche/Startseite) um
            if (lastFinalUrl && !/\/babe\//i.test(lastFinalUrl)) { const g = new Error('Profil leitet nicht mehr auf ein Profil weiter: ' + lastFinalUrl); g.gone = true; throw g; }
            const { profileData, babeId } = await parseProfileFromDoc(doc, url);
            // Weiterleitung auf ein anderes Profil (umbenannt oder von Babepedia zusammengelegt):
            // neue Adresse speichern und die alte mitschicken, damit das Tool beide Einträge zusammenführen kann
            if (profileData && lastFinalUrl && /\/babe\//i.test(lastFinalUrl) && slugOfUrl(lastFinalUrl) && slugOfUrl(lastFinalUrl) !== slugOfUrl(url)) {
                profileData['Profile URL'] = lastFinalUrl.replace(/^http:/, 'https:').replace(/[?#].*$/, '');
                profileData.__fromUrl = url;
            }
            if (!profileData || !profileData.Name) {
                // z. B. Bot-Schutz-/Captcha-Seite statt Profil
                throw new Error('Kein Profil auf der Seite gefunden (evtl. Bot-Schutz oder Login abgelaufen)');
            }
            const list = getStoredData();
            const index = list.findIndex(item => item['Profile URL'] === profileData['Profile URL']);
            if (index >= 0) list[index] = profileData; else list.push(profileData);
            saveStoredData(list);
            if (moveToListed) {
                // Daten sind schon im Batch; schlägt nur das Verschieben fehl, bleibt das Profil in NEU
                // und wird als Fehlschlag gemerkt, damit "↻ Fehlgeschlagene" es erneut verschiebt.
                await safeMoveBabeBetweenLists(babeId, LIST_NEU, LIST_GELISTET);
            }
            clearFailed(url);
            noteFetched(url);
            return { ok: true };
        } catch (err) {
            console.error(`[Fetch Fehler] ${url}:`, err.message);
            if (err && err.gone) {
                // Profil existiert auf Babepedia nicht mehr → dem Tool melden (Status „gelöscht“), nicht als Fehlschlag merken
                const list = getStoredData();
                if (!list.some(i => i['Profile URL'] === url && i.__gone)) list.push({ 'Profile URL': url, __gone: true, 'Scraped At': getTodayDDMMYYYY(), __reason: err.message });
                saveStoredData(list);
                clearFailed(url);
                noteFetched(url);
                return { ok: false, gone: true, error: err.message };
            }
            markFailed(url, moveToListed, err.message);
            return { ok: false, error: err.message };
        }
    }

    async function retryFailed(onProgress) {
        const todo = getFailed();
        if (!todo.length) { alert('Keine fehlgeschlagenen Profile gespeichert.'); return; }
        let ok = 0;
        for (let i = 0; i < todo.length; i++) {
            if (onProgress) onProgress(`↻ ${i + 1}/${todo.length}`);
            const res = await fetchOneProfile(todo[i].url, todo[i].move);
            if (res.ok) ok++;
            await new Promise(r => setTimeout(r, getRandomDelay(MIN_DELAY_MS + 1000, MAX_DELAY_MS + 2000)));
        }
        const rest = getFailed();
        alert(`${ok} von ${todo.length} Profilen nachgeholt.` +
              (rest.length ? `\nWeiterhin fehlgeschlagen: ${rest.length}\n\n` + rest.slice(0, 15).map(f => `• ${decodeURIComponent(f.url.split('/babe/')[1] || f.url)} – ${f.error}`).join('\n') : ''));
    }

    // ===================================================================
    // Abgleich: Profile, die schon im Organizer oder in einer deiner Listen sind
    // ===================================================================
    const plainSlug = (x) => String(x || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    function slugOfUrl(u) {
        let s = String(u || '');
        try { s = decodeURIComponent(s); } catch (e) {}
        const m = s.match(/\/babe\/([^/?#]+)/i);
        return m ? plainSlug(m[1].replace(/[\s_]+/g, '_')) : '';
    }
    const LIST_NAMES = { neu: 'NEU', gelistet: 'GELISTET', ranker: 'RANKER' };
    function getKnownLists() { const k = GM_getValue('bp_known_lists', {}); return k && typeof k === 'object' ? k : {}; }
    function rememberList(ctx, urls) {
        const lists = getKnownLists();
        lists[ctx] = { slugs: [...new Set(urls.map(slugOfUrl).filter(Boolean))], at: new Date().toISOString() };
        GM_setValue('bp_known_lists', lists);
        return lists[ctx].slugs.length;
    }
    function getKnownSets() {
        const slugs = new Set(), ids = new Set();
        const org = GM_getValue('bp_known_organizer', null);
        if (org && Array.isArray(org.slugs)) { org.slugs.forEach(x => slugs.add(x)); (org.ids || []).forEach(x => ids.add(String(x))); }
        Object.values(getKnownLists()).forEach(l => (l.slugs || []).forEach(x => slugs.add(x)));
        return { slugs, ids, org };
    }
    const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('de-DE'); } catch (e) { return '?'; } };
    function knownSummary() {
        const org = GM_getValue('bp_known_organizer', null);
        const lists = getKnownLists();
        const parts = [org ? `Organizer ${org.count} (${fmtDate(org.at)})` : '⚠️ Organizer noch nicht abgeglichen – Tool einmal öffnen'];
        for (const [k, name] of Object.entries(LIST_NAMES)) {
            parts.push(lists[k] ? `${name} ${lists[k].slugs.length} (${fmtDate(lists[k].at)})` : `${name} nicht gemerkt`);
        }
        return parts.join(' · ');
    }

    // ---- Battle-Standings ----
    const isStandings = () => /^\/battles\/standings/i.test(location.pathname);
    function standingsRowsFrom(doc) {
        return [...doc.querySelectorAll('#battle-standings li.bb-row')].map(li => {
            const a = li.querySelector('a.bb-row-name');
            return a ? { li, url: new URL(a.getAttribute('href'), 'https://www.babepedia.com').href, id: li.getAttribute('data-babe') || '' } : null;
        }).filter(Boolean);
    }
    const isKnown = (row, known) => (row.id && known.ids.has(String(row.id))) || known.slugs.has(slugOfUrl(row.url));

    function markKnownRows() {
        const known = getKnownSets();
        standingsRowsFrom(document).forEach(r => { r.li.style.opacity = isKnown(r, known) ? '0.35' : ''; });
    }

    // ---- Kachel-Seiten (Top 100, Most Viewed, Advanced Search, fremde Listen …) ----
    // Alle Seiten mit .thumbshot-Kacheln; Inhalte, die per AJAX nachkommen, werden über einen Beobachter erfasst.
    const isAdvSearch = () => /^\/advancedsearch/i.test(location.pathname);
    const isOwnList = () => !!LIST_NAMES[getListContext()];
    function thumbItems(root) {
        return [...root.querySelectorAll('.thumbshot')].filter(el => !el.closest('.sidebar_block')).map(el => {
            const a = el.querySelector('a[href*="/babe/"]');
            return a ? { el, url: new URL(a.getAttribute('href'), 'https://www.babepedia.com').href.split('#')[0] } : null;
        }).filter(Boolean);
    }
    function markKnownThumbs() {
        if (isOwnList()) return; // in den eigenen Listen wäre sonst alles grau
        const known = getKnownSets();
        thumbItems(document).forEach(t => { t.el.style.opacity = known.slugs.has(slugOfUrl(t.url)) ? '0.35' : ''; });
    }
    function watchThumbs() {
        markKnownThumbs();
        let t = null;
        new MutationObserver(() => { clearTimeout(t); t = setTimeout(markKnownThumbs, 150); })
            .observe(document.body, { childList: true, subtree: true });
        window.addEventListener('focus', markKnownThumbs);
    }

    async function copyThumbLinks(onlyNew, onProgress) {
        let urls = thumbItems(document).map(t => t.url);
        const total = getTotalPages(document);
        const cur = parseInt(new URL(location.href).searchParams.get('page') || '1', 10);
        // Advanced Search blättert per AJAX mit den Suchfiltern der Sitzung – dort nur die aktuelle Seite
        if (!isAdvSearch() && total > cur) {
            const ans = prompt(`Wie viele Seiten ab Seite ${cur} durchgehen? (1 = nur diese Seite, es gibt ${total})`, '1');
            if (ans === null) return;
            const n = Math.max(1, Math.min(total - cur + 1, parseInt(ans, 10) || 1));
            const failed = [];
            for (let p = cur + 1; p < cur + n; p++) {
                if (onProgress) onProgress(`📄 Seite ${p - cur + 1}/${n}`);
                try {
                    const html = await fetchWithRetry(pageUrl(p), {}, 5, 2000);
                    const found = thumbItems(new DOMParser().parseFromString(html, 'text/html'));
                    if (!found.length) throw new Error('keine Profile');
                    urls = urls.concat(found.map(t => t.url));
                } catch (err) { failed.push(p); }
                await new Promise(r => setTimeout(r, getRandomDelay(500, 900)));
            }
            if (failed.length) alert(`Diese Seiten konnten nicht geladen werden: ${failed.join(', ')}\nEs wird mit den übrigen weitergemacht.`);
        }
        urls = [...new Set(urls)];
        const known = getKnownSets();
        const out = onlyNew ? urls.filter(u => !known.slugs.has(slugOfUrl(u))) : urls;
        if (!out.length) { alert(onlyNew ? `Alle ${urls.length} Profile sind schon bekannt – nichts zu kopieren.` : 'Keine Links gefunden.'); return; }
        GM_setClipboard(out.join('\n'));
        alert(`${out.length} Links kopiert` + (onlyNew ? ` (${urls.length - out.length} von ${urls.length} schon bekannt, ausgelassen).\n\nAbgleich mit: ${knownSummary()}` : '.'));
    }

    async function copyStandingsLinks(onlyNew, onProgress) {
        const allPages = confirm('Alle Seiten der Standings durchgehen?\n\n[OK] = Alle Seiten\n[Abbrechen] = Nur diese Seite');
        let rows = standingsRowsFrom(document);
        if (allPages) {
            const total = getTotalPages(document);
            const cur = parseInt(new URL(location.href).searchParams.get('page') || '1', 10);
            const failed = [];
            for (let p = 1; p <= total; p++) {
                if (p === cur) continue;
                if (onProgress) onProgress(`📄 Seite ${p}/${total}`);
                try {
                    const html = await fetchWithRetry(`https://www.babepedia.com/battles/standings?page=${p}`, {}, 5, 2000);
                    const found = standingsRowsFrom(new DOMParser().parseFromString(html, 'text/html'));
                    if (!found.length) throw new Error('keine Einträge');
                    rows = rows.concat(found);
                } catch (err) { failed.push(p); }
                await new Promise(r => setTimeout(r, getRandomDelay(400, 800)));
            }
            if (failed.length) alert(`Diese Seiten konnten nicht geladen werden: ${failed.join(', ')}\nEs wird mit den übrigen weitergemacht.`);
        }
        const seen = new Set();
        rows = rows.filter(r => !seen.has(r.url) && seen.add(r.url));
        const known = getKnownSets();
        const out = onlyNew ? rows.filter(r => !isKnown(r, known)) : rows;
        if (!out.length) { alert(onlyNew ? `Alle ${rows.length} Profile sind schon bekannt – nichts zu kopieren.` : 'Keine Links gefunden.'); return; }
        GM_setClipboard(out.map(r => r.url).join('\n'));
        alert(`${out.length} Links kopiert` + (onlyNew ? ` (${rows.length - out.length} von ${rows.length} schon bekannt, ausgelassen).` : '.') +
              (onlyNew ? `\n\nAbgleich mit: ${knownSummary()}` : ''));
    }

    async function autoFetchAllProfiles(onProgress) {
        const moveToListed = shouldMoveForThisPage();
        const includeAllPages = confirm("Möchtest du ALLE Folgeseiten dieser Liste durchsuchen?\n\n[OK] = Alle Seiten (z.B. 1 bis 20) nacheinander abklappern\n[Abbrechen] = Nur diese aktuelle Seite verarbeiten");
        
        const links = includeAllPages ? await getAllBabeLinksMultiPage(onProgress && ((txt) => onProgress(txt))) : getBabeLinksFromDoc(document);

        if (links.length === 0) {
            alert('Keine /babe/ Profil-Links gefunden!');
            return;
        }

        let okCount = 0, goneCount = 0;
        const failedPages = [];

        for (let i = 0; i < links.length; i++) {
            const url = links[i];
            if (onProgress) onProgress(i + 1, links.length);
            const res = await fetchOneProfile(url, moveToListed);
            if (res.ok) okCount++; else if (res.gone) goneCount++; else failedPages.push({ url, error: res.error, move: moveToListed });
            await new Promise(r => setTimeout(r, getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS)));
        }

        if (failedPages.length > 0) {
            console.warn("=== FEHLGESCHLAGENE PROFILE ===");
            console.table(failedPages);
        }
        await finishRun('Auto Fetch fertig', okCount, links.length, failedPages, onProgress, goneCount);
    }

    function initArchiveUI() {
        const container = document.createElement('div');
        container.className = 'bp-btn-container';
        const t = ARCHIVE.ts;
        const status = document.createElement('div');
        status.textContent = `🏛️ Archiv-Kopie vom ${t.slice(6, 8)}.${t.slice(4, 6)}.${t.slice(0, 4)}`;
        status.style.cssText = 'width:170px;font-size:11px;line-height:1.3;color:#fff;background:rgba(0,0,0,.75);padding:6px 8px;border-radius:6px;';

        const addBtn = document.createElement('button');
        addBtn.id = 'bp-add-btn';
        addBtn.className = 'bp-btn';
        const label = () => { addBtn.innerHTML = `➕ Aus Archiv übernehmen (${getStoredData().length})`; };
        label();
        window.addEventListener('focus', label);
        addBtn.addEventListener('click', async () => {
            addBtn.disabled = true;
            try {
                const { profileData } = await parseProfileFromDoc(document, ARCHIVE.url);
                if (!profileData.Name) throw new Error('Auf dieser Archiv-Seite wurde kein Profil gefunden (evtl. älteres Seitenlayout).');
                const list = getStoredData();
                const i = list.findIndex(x => x['Profile URL'] === profileData['Profile URL']);
                if (i >= 0) list[i] = profileData; else list.push(profileData);
                saveStoredData(list);
                addBtn.style.backgroundColor = '#2e7d32';
            } catch (err) {
                console.error('[Archiv Fehler]', err);
                addBtn.style.backgroundColor = '#c62828';
                alert(err.message);
            }
            label();
            addBtn.disabled = false;
            setTimeout(() => { addBtn.style.backgroundColor = ''; }, 1500);
        });

        const toolBtn = document.createElement('button');
        toolBtn.id = 'bp-tool-btn';
        toolBtn.className = 'bp-btn';
        toolBtn.innerHTML = '🗂️ Tool öffnen';
        toolBtn.addEventListener('click', () => GM_openInTab(TOOL_URL, { active: true }));

        container.append(status, addBtn, toolBtn);
        document.body.appendChild(container);
    }

    function initUI() {
        if (ARCHIVE) return initArchiveUI();
        const container = document.createElement('div');
        container.className = 'bp-btn-container';

        const addBtn = document.createElement('button');
        addBtn.id = 'bp-add-btn';
        addBtn.className = 'bp-btn';

        const updateAddBtnText = () => {
            const count = getStoredData().length;
            addBtn.innerHTML = `➕ Add (${count})`;
        };
        updateAddBtnText();
        // Nach dem Übertragen ans Tool ist der Batch leer – Zähler beim Zurückwechseln aktualisieren
        window.addEventListener('focus', updateAddBtnText);

        addBtn.addEventListener('click', async () => {
            addBtn.disabled = true;
            addBtn.innerHTML = '⏳ Adding...';
            
            try {
                const { profileData, babeId } = await parseProfileFromDoc(document, window.location.href);
                const list = getStoredData();
                
                const index = list.findIndex(i => i['Profile URL'] === profileData['Profile URL']);
                if (index >= 0) list[index] = profileData;
                else list.push(profileData);
                
                saveStoredData(list);
                updateAddBtnText();

                await safeMoveBabeBetweenLists(babeId, LIST_NEU, LIST_GELISTET);
                addBtn.style.backgroundColor = '#2e7d32';
            } catch (err) {
                console.error("[Add Fehler]", err);
                addBtn.style.backgroundColor = '#c62828';
                alert('Profil wurde gespeichert, aber das Verschieben nach GELISTET hat nicht geklappt:\n' + err.message +
                      '\n\nDas Profil bleibt in NEU. Bist du noch eingeloggt?');
            }

            addBtn.disabled = false;
            setTimeout(() => { addBtn.style.backgroundColor = '#2b5c8f'; }, 1500);
        });

        const autoFetchBtn = document.createElement('button');
        autoFetchBtn.id = 'bp-autofetch-btn';
        autoFetchBtn.className = 'bp-btn';
        autoFetchBtn.innerHTML = '🚀 Auto Fetch All';

        autoFetchBtn.addEventListener('click', async () => {
            autoFetchBtn.disabled = true;
            autoFetchBtn.style.opacity = '0.7';

            await autoFetchAllProfiles((current, total) => {
                autoFetchBtn.innerHTML = typeof current === 'string' ? current : `⏳ ${current}/${total} Fetched`;
                updateAddBtnText();
            });

            autoFetchBtn.innerHTML = '✅ Done!';
            autoFetchBtn.style.backgroundColor = '#2e7d32';

            setTimeout(() => {
                autoFetchBtn.innerHTML = '🚀 Auto Fetch All';
                autoFetchBtn.style.backgroundColor = '#e65100';
                autoFetchBtn.disabled = false;
                autoFetchBtn.style.opacity = '1';
            }, 3000);
        });

        const updateBtn = document.createElement('button');
        updateBtn.id = 'bp-update-btn';
        updateBtn.className = 'bp-btn';
        const updLabel = () => {
            const pl = (GM_getValue('bp_known_organizer', null) || {}).plan;
            if (pl && pl.recommended) { updateBtn.classList.add('due'); return `🔁 Update · ${pl.recommended} fällig`; }
            updateBtn.classList.remove('due'); return '🔁 Update (älteste)';
        };
        updateBtn.innerHTML = updLabel();
        updateBtn.title = 'Holt die Profile neu, die im Tool am längsten nicht aktualisiert wurden (Anzahl wählbar)';
        updateBtn.addEventListener('click', async () => {
            updateBtn.disabled = true;
            await updateOldest((txt) => { updateBtn.innerHTML = txt; updateAddBtnText(); });
            updateBtn.innerHTML = updLabel();
            updateBtn.disabled = false;
            updateAddBtnText();
        });

        const toolBtn = document.createElement('button');
        toolBtn.id = 'bp-tool-btn';
        toolBtn.className = 'bp-btn';
        toolBtn.innerHTML = '🗂️ Tool öffnen';
        toolBtn.title = 'Öffnet den Babe Organizer – gesammelte Profile werden dort automatisch übernommen · Shift+Klick: gesammelte Profile verwerfen';
        toolBtn.addEventListener('click', (ev) => {
            if (ev.shiftKey) {
                const n = getStoredData().length;
                if (n && confirm(`${n} gesammelte Profile verwerfen, ohne sie ins Tool zu übernehmen?`)) { saveStoredData([]); updateAddBtnText(); }
                return;
            }
            if (TOOL_URL.includes('DEIN-GITHUB-NAME')) {
                alert('Bitte zuerst oben im Skript TOOL_URL auf die Adresse deines Tools setzen.');
                return;
            }
            GM_openInTab(TOOL_URL, { active: true });
        });

        const failedBtn = document.createElement('button');
        failedBtn.id = 'bp-failed-btn';
        failedBtn.className = 'bp-btn';
        const updateFailedBtn = () => {
            const n = getFailed().length;
            failedBtn.innerHTML = `↻ Fehlgeschlagene (${n})`;
            failedBtn.style.display = n ? '' : 'none';
        };
        window.__bpUpdateFailedBtn = updateFailedBtn;
        updateFailedBtn();
        failedBtn.addEventListener('click', async (ev) => {
            if (ev.shiftKey) {
                console.table(getFailed());
                if (confirm('Liste der fehlgeschlagenen Profile leeren?')) setFailed([]);
                return;
            }
            failedBtn.disabled = true;
            await retryFailed((txt) => { failedBtn.innerHTML = txt; });
            failedBtn.disabled = false;
            updateFailedBtn();
            updateAddBtnText();
        });
        failedBtn.title = 'Klick: erneut versuchen · Shift+Klick: Liste anzeigen/leeren';


        // Eigene Liste für den Standings-Abgleich merken
        const rememberBtn = document.createElement('button');
        rememberBtn.id = 'bp-remember-btn';
        rememberBtn.className = 'bp-btn';
        const ctxNow = getListContext();
        const rememberLabel = () => {
            const l = getKnownLists()[ctxNow];
            rememberBtn.innerHTML = `📌 ${LIST_NAMES[ctxNow] || ''} für Abgleich merken` + (l ? ` (${fmtDate(l.at)})` : '');
        };
        if (LIST_NAMES[ctxNow]) rememberLabel(); else rememberBtn.style.display = 'none';
        rememberBtn.title = 'Alle Seiten dieser Liste einsammeln; diese Profile werden auf der Battle-Standings-Seite als bekannt ausgelassen';
        rememberBtn.addEventListener('click', async () => {
            rememberBtn.disabled = true;
            const links = await getAllBabeLinksMultiPage((txt) => { rememberBtn.innerHTML = txt; });
            const n = rememberList(ctxNow, links);
            alert(`${n} Profile der Liste ${LIST_NAMES[ctxNow]} gemerkt.`);
            rememberLabel();
            rememberBtn.disabled = false;
        });

        // Battle-Standings: Links kopieren
        const newLinksBtn = document.createElement('button');
        newLinksBtn.id = 'bp-newlinks-btn';
        newLinksBtn.className = 'bp-btn';
        newLinksBtn.innerHTML = '🆕 Neue Links kopieren';
        newLinksBtn.title = 'Nur Profile kopieren, die weder im Organizer noch in einer gemerkten Liste sind';
        const allLinksBtn = document.createElement('button');
        allLinksBtn.id = 'bp-alllinks-btn';
        allLinksBtn.className = 'bp-btn';
        allLinksBtn.innerHTML = '📋 Alle Links kopieren';
        // Kachel-Seiten: alles außer eigenen Listen und Profilseiten, sobald Kacheln da sind (bzw. Advanced Search)
        const isThumbPage = !isStandings() && !isOwnList() && getListContext() !== 'profil' &&
            (isAdvSearch() || document.querySelector('.thumbshot a[href*="/babe/"]'));
        [[newLinksBtn, true], [allLinksBtn, false]].forEach(([btn, onlyNew]) => {
            const label = btn.innerHTML;
            if (!isStandings() && !isThumbPage) btn.style.display = 'none';
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                if (isStandings()) await copyStandingsLinks(onlyNew, (txt) => { btn.innerHTML = txt; });
                else await copyThumbLinks(onlyNew, (txt) => { btn.innerHTML = txt; });
                btn.innerHTML = label;
                btn.disabled = false;
            });
        });
        if (isStandings()) {
            autoFetchBtn.style.display = 'none';
            updateBtn.style.display = 'none';
            markKnownRows();
            window.addEventListener('focus', markKnownRows);
        }
        if (isAdvSearch()) {
            autoFetchBtn.style.display = 'none';
            updateBtn.style.display = 'none';
        }
        if (!isStandings()) watchThumbs();

        const ctxLabel = {
            neu: '📥 Liste NEU → wird nach GELISTET verschoben',
            gelistet: '✅ Liste GELISTET → bleibt unverändert',
            ranker: '🏆 Liste RANKER → bleibt unverändert',
            profil: 'Profil: Add nimmt es in GELISTET auf',
            andere: 'Keine deiner Listen erkannt'
        }[getListContext()];
        const status = document.createElement('div');
        const knownLabel = () => `Bekannt (ausgegraut): ${knownSummary()}`;
        const withKnown = isStandings() || !!isThumbPage;
        status.textContent = withKnown ? knownLabel() : ctxLabel;
        if (withKnown) window.addEventListener('focus', () => { status.textContent = knownLabel(); });
        status.style.cssText = 'width:170px;font-size:11px;line-height:1.3;color:#fff;background:rgba(0,0,0,.65);padding:6px 8px;border-radius:6px;';
        container.appendChild(status);
        container.appendChild(rememberBtn);
        container.appendChild(newLinksBtn);
        container.appendChild(allLinksBtn);
        container.appendChild(addBtn);
        container.appendChild(toolBtn);
        container.appendChild(autoFetchBtn);
        container.appendChild(updateBtn);
        container.appendChild(failedBtn);
        document.body.appendChild(container);
    }

    window.addEventListener('load', initUI);
})();
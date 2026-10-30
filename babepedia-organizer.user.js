// ==UserScript==
// @name         Babepedia Batch Extractor & Auto-Fetcher (Babe Organizer)
// @namespace    http://tampermonkey.net/
// @version      14.0
// @description  Auto-fetch profile data + Safe List Moving with Multi-Page / Loop Support + Übertragung an den Babe Organizer (GitHub Pages)
// @author       Mudkip
// @match        https://www.babepedia.com/*
// @match        https://thevizce.github.io/b-organizer/*
// @updateURL    https://raw.githubusercontent.com/TheVizce/b-organizer/main/babepedia-organizer.user.js
// @downloadURL  https://raw.githubusercontent.com/TheVizce/b-organizer/main/babepedia-organizer.user.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @connect      www.babepedia.com
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

        window.addEventListener('message', (ev) => {
            if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
            const d = ev.data;

            if (d.type === 'BP_TOOL_READY' && !sent) {
                sent = true;
                const batch = GM_getValue('bp_batch_data', []);
                if (Array.isArray(batch) && batch.length) {
                    sentUrls = new Set(batch.map(i => i['Profile URL']));
                    window.postMessage({ type: 'BP_SYNC', id: syncId, items: batch }, location.origin);
                }
                const ranker = GM_getValue('bp_ranker_sync', null);
                if (ranker && Array.isArray(ranker.urls)) {
                    window.postMessage({ type: 'BP_RANKER', id: syncId, ...ranker }, location.origin);
                }
            }

            if (d.type === 'BP_RANKER_ACK' && d.id === syncId) {
                GM_setValue('bp_ranker_sync', null);
            }

            if (d.type === 'BP_SYNC_ACK' && d.id === syncId) {
                // Nur die übertragenen Einträge aus dem Batch entfernen (falls parallel neue dazukamen)
                const rest = GM_getValue('bp_batch_data', []).filter(i => !sentUrls.has(i['Profile URL']));
                GM_setValue('bp_batch_data', rest);
            }
        });

        // Falls das Tool schon geladen ist: anpingen
        window.postMessage({ type: 'BP_PING' }, location.origin);
        return;
    }

    // ===================================================================
    // Teil 2: Läuft auf babepedia.com
    // ===================================================================

    // Aktualisiertes Schema (ohne redundante Status-Felder bei Tattoos/Piercings)
    const FIELDS = [
        'Name', 'AKA', 'Profile URL', 'Main Image URL', 
        'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links', 'Scraped At',
        'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays',
        'Born', 'Exact Birthdate', 'Died', 'Years active', 'Active', 'Active till', 'Birthplace',
        'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Hair color',
        'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup',
        'Boobs', 'Tattoos', 'Piercings',
        // External & Social Links
        'Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch',
        'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Boobpedia Link'
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
        'sudanese': 'SD', 'surinamese': 'SR', 'svalbard': 'SJ', 'swazi': 'SZ', 'swedish': 'SE', 'swiss': 'CH',
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
        ['Science / Health / Education', ['Cybersecurity expert', 'Dentist', 'Doctor - Physician', 'Nurse', 'Professor', 'Programmer', 'Science Communicator', 'Sex Therapist', 'Teacher']],
        ['Business / Law / Politics', ['Activist', 'Barrister', 'Business Woman', 'Lawyer', 'Military Personnel', 'Political Commentator', 'Politician', 'Realtor', 'Royalty']],
        ['Creative & Design', ['Artist', 'Author', 'Fashion Designer', 'Graphic Designer', 'Photographer', 'Writer']],
        ['Service & Hospitality', ['Barista', 'Bartender', 'Beautician', 'Flight Attendant', 'Hooters Girl', 'Nail Designer']],
        ['Sonstige', ['Housewife', 'Paranormal Investigator', 'Student', 'Trucker']]
    ];
    // Für Werte, die (noch) nicht in der Liste stehen: Regeln nach Wortbestandteilen
    const PROFESSION_RULES = [
        [/sportswoman|athlete|player|boxer|fighter|skater|racer|gymnast|swimmer|surfer|skier|wrestler|cyclist|runner/i, 'Athletics & Sports'],
        [/musician|singer|rapper|\bdj\b|pop idol|band/i, 'Music'],
        [/scientist|engineer|doctor|physician|biologist|researcher/i, 'Science / Health / Education'],
        [/porn|adult (film|actress)|onlyfans/i, 'Adult Industry'],
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
        #bp-movelist-btn { background-color: #00838f; }
        #bp-movelist-btn:hover { background-color: #005662; }
        #bp-dl-btn { background-color: #2e7d32; }
        #bp-dl-btn:hover { background-color: #1b5e20; }
        #bp-copy-btn { background-color: #6a1b9a; }
        #bp-copy-btn:hover { background-color: #4a148c; }
        #bp-tool-btn { background-color: #ad3a63; }
        #bp-tool-btn:hover { background-color: #7d2747; }
        #bp-failed-btn { background-color: #8d6e00; }
        #bp-failed-btn:hover { background-color: #5f4a00; }
        #bp-ranker-btn { background-color: #b8860b; }
        #bp-ranker-btn:hover { background-color: #8a6508; }
        #bp-clear-btn { background-color: #c62828; }
        #bp-clear-btn:hover { background-color: #8e0000; }
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

                if (res.status < 200 || res.status >= 300) {
                    throw new Error(`HTTP ${res.status}`);
                }

                return res.responseText;
            } catch (err) {
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

        data['Highest Rank'] = '';
        data['Peakdays'] = '';
        const highestRankEl = doc.querySelector('.rating-rank small');
        if (highestRankEl && highestRankEl.innerText.trim() !== '') {
            const match = highestRankEl.innerText.match(/(\d+)/);
            if (match) data['Highest Rank'] = match[1];

            const peakLink = highestRankEl.querySelector('a[href*="numberonetop100"]');
            if (peakLink) {
                const dayMatch = peakLink.innerText.match(/#1\s+for\s+(\d+)\s+day/i);
                if (dayMatch) data['Peakdays'] = dayMatch[1];
            }
        }

        if (!data['Highest Rank']) {
            const rankingGraphAnchor = doc.querySelector('.rating-rank a[href*="/rankinggraph/"]');
            if (rankingGraphAnchor) {
                let rankGraphHref = rankingGraphAnchor.getAttribute('href') || rankingGraphAnchor.href || '';
                if (rankGraphHref) {
                    const fullRankUrl = rankGraphHref.startsWith('/') ? `https://www.babepedia.com${rankGraphHref}` : rankGraphHref;
                    try {
                        const rankHtml = await fetchWithRetry(fullRankUrl, {}, 2);
                        const matchHighest = rankHtml.match(/Highest rank:\s*#?(\d+)/i);
                        if (matchHighest) {
                            data['Highest Rank'] = matchHighest[1];
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
                    const triple = /(\d+(?:\.\d+)?)\s*[\-–—]\s*(\d+(?:\.\d+)?)\s*[\-–—]\s*(\d+(?:\.\d+)?)\s*(cm|in(?:ch(?:es)?)?\b|["″])?/gi;
                    const all = [...value.matchAll(triple)];
                    const cmHit = all.find(m => m[4] && m[4].toLowerCase() === 'cm');
                    const match = cmHit || all[0];
                    if (match) {
                        const isInch = !cmHit && (/^(in|inch|inches|"|″)$/i.test(match[4] || '') || parseFloat(match[1]) < 60);
                        const f = isInch ? 2.54 : 1;
                        const [bust, waist, hips] = [match[1], match[2], match[3]].map(x => Math.round(parseFloat(x) * f));
                        data['Measurements'] = `${bust}-${waist}-${hips}`;
                    } else {
                        data['Measurements'] = value;
                    }
                } else if (label === 'Bra/cup size') {
                    const cupMatch = value.match(/^[0-9]+\s*([A-Za-z]+)/);
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

    function buildBatchCSV(list) {
        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '""';
            let str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const lines = [];
        lines.push(FIELDS.map(f => escapeCSV(f)).join(','));

        list.forEach(item => {
            lines.push(FIELDS.map(f => escapeCSV(item[f] || '')).join(','));
        });

        return lines.join('\n');
    }

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

    // Holt ein einzelnes Profil, legt es im Batch ab und verschiebt es ggf. in GELISTET
    async function fetchOneProfile(url, moveToListed) {
        try {
            const htmlText = await fetchWithRetry(url);
            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            const { profileData, babeId } = await parseProfileFromDoc(doc, url);
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
            return { ok: true };
        } catch (err) {
            console.error(`[Fetch Fehler] ${url}:`, err.message);
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

    // Sammelt alle Profil-Links der RANKER-Liste und legt sie für das Tool bereit
    async function collectRankerList(onProgress) {
        if (getListContext() !== 'ranker') {
            alert('Bitte zuerst deine Ranker-Liste (ID ' + LIST_RANKER + ') öffnen, am besten nach Name sortiert.');
            return;
        }
        const links = await getAllBabeLinksMultiPage(onProgress);
        const urls = [...new Set(links.map(u => u.split('?')[0].split('#')[0]))];
        const expected = getExpectedListTotal(document);
        GM_setValue('bp_ranker_sync', { urls, expected, at: new Date().toISOString() });
        alert(`Ranker-Abgleich: ${urls.length} Profile gesammelt` + (expected ? ` (laut Babepedia ${expected})` : '') +
              `.\n\nJetzt über „🗂️ Tool öffnen“ ins Tool übernehmen – dort wird „In Ranker“ für alle Einträge gesetzt.`);
    }

    async function autoFetchAllProfiles(onProgress) {
        const moveToListed = shouldMoveForThisPage();
        const includeAllPages = confirm("Möchtest du ALLE Folgeseiten dieser Liste durchsuchen?\n\n[OK] = Alle Seiten (z.B. 1 bis 20) nacheinander abklappern\n[Abbrechen] = Nur diese aktuelle Seite verarbeiten");
        
        const links = includeAllPages ? await getAllBabeLinksMultiPage(onProgress && ((txt) => onProgress(txt))) : getBabeLinksFromDoc(document);

        if (links.length === 0) {
            alert('Keine /babe/ Profil-Links gefunden!');
            return;
        }

        let okCount = 0;
        const failedPages = [];

        for (let i = 0; i < links.length; i++) {
            const url = links[i];
            if (onProgress) onProgress(i + 1, links.length);
            const res = await fetchOneProfile(url, moveToListed);
            if (res.ok) okCount++; else failedPages.push({ url, error: res.error });
            await new Promise(r => setTimeout(r, getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS)));
        }

        if (failedPages.length > 0) {
            console.warn("=== FEHLGESCHLAGENE PROFILE ===");
            console.table(failedPages);
        }
        alert(`Auto Fetch fertig: ${okCount} von ${links.length} Profilen geholt.` +
              (failedPages.length ? `\n${failedPages.length} fehlgeschlagen – über „↻ Fehlgeschlagene“ erneut versuchen.` : '') +
              `\n\nÜber „🗂️ Tool öffnen“ ins Tool übernehmen.`);
    }

    async function moveListsOnly(onProgress) {
        const ctx = getListContext();
        if (ctx === 'gelistet' || ctx === 'ranker') {
            alert('In dieser Liste gibt es nichts zu verschieben.');
            return;
        }
        if (ctx !== 'neu' && !confirm('Diese Seite ist nicht deine NEU-Liste. Trotzdem alle Profile dieser Seite nach GELISTET verschieben?')) {
            return;
        }
        const includeAllPages = confirm("Möchtest du ALLE Folgeseiten dieser Liste durchsuchen?\n\n[OK] = Alle Seiten (z.B. 1 bis 20) abklappern\n[Abbrechen] = Nur diese aktuelle Seite verarbeiten");

        const links = includeAllPages ? await getAllBabeLinksMultiPage(onProgress && ((txt) => onProgress(txt))) : getBabeLinksFromDoc(document);

        if (links.length === 0) {
            alert('Keine /babe/ Profil-Links gefunden!');
            return;
        }

        const failedPages = [];
        let successCount = 0;

        for (let i = 0; i < links.length; i++) {
            const url = links[i];
            if (onProgress) onProgress(i + 1, links.length);

            try {
                const htmlText = await fetchWithRetry(url);
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                
                let babeId = extractBabeId(doc);

                if (babeId) {
                    await safeMoveBabeBetweenLists(babeId, LIST_NEU, LIST_GELISTET);
                    successCount++;
                } else {
                    throw new Error("Babe ID konnte nicht ermittelt werden");
                }
            } catch (err) {
                console.error(`[MoveList Fehler] ${url}:`, err.message);
                failedPages.push({ url, error: err.message });
                markFailed(url, true, err.message);
            }

            const delay = getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
            await new Promise(r => setTimeout(r, delay));
        }

        console.log("================ MOVE LISTS ZUSAMMENFASSUNG ================");
        console.log(`Erfolgreich: ${successCount} | Fehlgeschlagen: ${failedPages.length}`);
        if (failedPages.length > 0) {
            console.table(failedPages);
        }
        console.log("============================================================");
    }

    function initUI() {
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

        const moveListBtn = document.createElement('button');
        moveListBtn.id = 'bp-movelist-btn';
        moveListBtn.className = 'bp-btn';
        moveListBtn.innerHTML = '🔄 Move Lists Only';

        moveListBtn.addEventListener('click', async () => {
            moveListBtn.disabled = true;
            moveListBtn.style.opacity = '0.7';

            await moveListsOnly((current, total) => {
                moveListBtn.innerHTML = typeof current === 'string' ? current : `⏳ ${current}/${total} Moved`;
            });

            moveListBtn.innerHTML = '✅ Moved All!';
            moveListBtn.style.backgroundColor = '#2e7d32';

            setTimeout(() => {
                moveListBtn.innerHTML = '🔄 Move Lists Only';
                moveListBtn.style.backgroundColor = '#00838f';
                moveListBtn.disabled = false;
                moveListBtn.style.opacity = '1';
            }, 3000);
        });

        const dlBtn = document.createElement('button');
        dlBtn.id = 'bp-dl-btn';
        dlBtn.className = 'bp-btn';
        dlBtn.innerHTML = '📥 Download CSV';

        dlBtn.addEventListener('click', () => {
            const list = getStoredData();
            if (list.length === 0) {
                alert('Der Batch ist leer! Klicke zuerst auf "Add" oder "Auto Fetch All".');
                return;
            }
            const csvText = buildBatchCSV(list);
            const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `notion_batch_${list.length}_profiles.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        const copyBtn = document.createElement('button');
        copyBtn.id = 'bp-copy-btn';
        copyBtn.className = 'bp-btn';
        copyBtn.innerHTML = '📋 Copy Babe Links';

        copyBtn.addEventListener('click', async () => {
            const includeAllPages = confirm("Möchtest du die Links ALLER Folgeseiten kopieren?\n\n[OK] = Alle Seiten der Liste kopieren\n[Abbrechen] = Nur Links der aktuellen Seite kopieren");
            const linkList = includeAllPages ? await getAllBabeLinksMultiPage() : getBabeLinksFromDoc(document);

            if (linkList.length === 0) {
                alert('Keine /babe/ Links gefunden!');
                return;
            }
            const textToCopy = linkList.join('\n');
            if (typeof GM_setClipboard !== 'undefined') GM_setClipboard(textToCopy);
            else navigator.clipboard.writeText(textToCopy);

            copyBtn.innerHTML = `✅ Copied (${linkList.length})`;
            copyBtn.style.backgroundColor = '#2e7d32';
            setTimeout(() => { 
                copyBtn.innerHTML = '📋 Copy Babe Links';
                copyBtn.style.backgroundColor = '#6a1b9a';
            }, 2000);
        });

        const toolBtn = document.createElement('button');
        toolBtn.id = 'bp-tool-btn';
        toolBtn.className = 'bp-btn';
        toolBtn.innerHTML = '🗂️ Tool öffnen';
        toolBtn.title = 'Öffnet den Babe Organizer – gesammelte Profile werden dort automatisch übernommen';
        toolBtn.addEventListener('click', () => {
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

        const rankerBtn = document.createElement('button');
        rankerBtn.id = 'bp-ranker-btn';
        rankerBtn.className = 'bp-btn';
        rankerBtn.innerHTML = '🏆 Ranker-Abgleich';
        rankerBtn.title = 'Alle Profile der Ranker-Liste einsammeln und im Tool als „In Ranker“ markieren';
        if (getListContext() !== 'ranker') rankerBtn.style.display = 'none';
        rankerBtn.addEventListener('click', async () => {
            rankerBtn.disabled = true;
            await collectRankerList((txt) => { rankerBtn.innerHTML = txt; });
            rankerBtn.innerHTML = '🏆 Ranker-Abgleich';
            rankerBtn.disabled = false;
        });

        const clearBtn = document.createElement('button');
        clearBtn.id = 'bp-clear-btn';
        clearBtn.className = 'bp-btn';
        clearBtn.innerHTML = '🗑️ Clear Batch';
        clearBtn.addEventListener('click', () => {
            if (confirm('Batch-Liste wirklich leeren?')) {
                saveStoredData([]);
                updateAddBtnText();
            }
        });

        const ctxLabel = {
            neu: '📥 Liste NEU → wird nach GELISTET verschoben',
            gelistet: '✅ Liste GELISTET → bleibt unverändert',
            ranker: '🏆 Liste RANKER → „Ranker-Abgleich“ nutzen',
            profil: 'Profil: Add nimmt es in GELISTET auf',
            andere: 'Keine deiner Listen erkannt'
        }[getListContext()];
        const status = document.createElement('div');
        status.textContent = ctxLabel;
        status.style.cssText = 'width:170px;font-size:11px;line-height:1.3;color:#fff;background:rgba(0,0,0,.65);padding:6px 8px;border-radius:6px;';
        container.appendChild(status);
        container.appendChild(rankerBtn);
        container.appendChild(addBtn);
        container.appendChild(toolBtn);
        container.appendChild(autoFetchBtn);
        container.appendChild(moveListBtn);
        container.appendChild(dlBtn);
        container.appendChild(copyBtn);
        container.appendChild(failedBtn);
        container.appendChild(clearBtn);
        document.body.appendChild(container);
    }

    window.addEventListener('load', initUI);
})();
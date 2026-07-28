// ==UserScript==
// @name         MneOS Sovereign Gemini Vault Harvester v6.3 (ADA Compliance Edition)
// @namespace    http://mneos.ai/
// @version      6.3
// @description  ADA-Compliant 100% Session Harvester with Auto-Top-Scroll Unroll & Brita-Lite Reverse Sync
// @match        *://gemini.google.com/*
// @include      *://gemini.google.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // Prevent duplicate execution inside embedded Google iframes
    if (window.self !== window.top) return;

    const filterKeywords = [
        'installHook.js',
        'No ID or name found in config',
        'violates the following Content Security Policy',
        'preloaded using link preload',
        'powerPreference',
        'requestAdapter',
        'BardChatUi',
        'gtm.js',
        'doubleclick.net',
        'google-analytics.com'
    ];

    const EXCLUSION_PATTERNS = [
        'nan-banana',
        'nan_banana',
        'nanbanana',
        'portrait',
        'photorealistic',
        'photo edit',
        'remove object',
        'image generation',
        'video generation',
        'low-angle perspective',
        'ai face',
        'face on pillow',
        'ticklish foot',
        'freckled woman',
        'veo video',
        'imagen 3'
    ];

    const UI_BOILERPLATE_PATTERNS = [
        'sync current session',
        'auto-harvest all chats',
        'stop crawl',
        'reset cache',
        'stabilizing dom',
        'cache cleared',
        'scanning cards',
        'waiting for turns',
        'unrolling'
    ];

    function isExcludedTitleOrId(titleOrId) {
        if (!titleOrId) return false;
        const lower = String(titleOrId).toLowerCase();
        return EXCLUSION_PATTERNS.some(pat => lower.includes(pat));
    }

    function isUiBoilerplateText(text) {
        if (!text) return true;
        const lower = String(text).toLowerCase();
        return UI_BOILERPLATE_PATTERNS.some(pat => lower.includes(pat));
    }

    function shouldSuppress(args) {
        try {
            const str = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            return filterKeywords.some(kw => str.includes(kw));
        } catch(e) {
            return false;
        }
    }

    function patchConsoleTarget(targetConsole) {
        if (!targetConsole) return;
        ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
            const original = targetConsole[method];
            if (typeof original === 'function' && !original.__mneos_patched) {
                const patched = function(...args) {
                    if (shouldSuppress(args)) return;
                    original.apply(targetConsole, args);
                };
                patched.__mneos_patched = true;
                targetConsole[method] = patched;
            }
        });
    }

    patchConsoleTarget(window.console);
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.console) {
        patchConsoleTarget(unsafeWindow.console);
    }

    console.log("[MneOS Gemini Harvester v6.3] Initialized with ADA Compliance & Auto Sequential Unroll.");

    const targetWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (targetWin.trustedTypes && targetWin.trustedTypes.createPolicy) {
        if (!targetWin.trustedTypes.defaultPolicy) {
            try {
                targetWin.trustedTypes.createPolicy('default', {
                    createHTML: (string) => string,
                    createScriptURL: (string) => string,
                    createScript: (string) => string
                });
            } catch(e) {}
        }
    }

    const DAEMON_URL = 'http://127.0.0.1:3334/api/save-session';
    const VISITED_KEY = 'mneos_gemini_visited_sessions';
    const CRAWL_ACTIVE_KEY = 'mneos_gemini_crawl_active';
    const ADA_INDEX_KEY = 'mneos_gemini_ada_index';

    let lastObservedUrl = location.href;

    function getStorageJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch(e) {
            return fallback;
        }
    }

    function setStorageJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch(e) {}
    }

    function markVisited(idOrTitle) {
        const visited = getStorageJSON(VISITED_KEY, []);
        if (idOrTitle && !visited.includes(idOrTitle)) {
            visited.push(idOrTitle);
            setStorageJSON(VISITED_KEY, visited);
        }
    }

    function isVisited(idOrTitle) {
        const visited = getStorageJSON(VISITED_KEY, []);
        return idOrTitle && visited.includes(idOrTitle);
    }

    function cleanupLegacyDuplicateUI() {
        const legacySelectors = ['#mneos-harvester-container', '#mneos-batch-container', '#mneos-single-btn', '#mneos-batch-btn', '#mneos-sync-btn', '#mneos-crawl-btn'];
        legacySelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });
    }

    function injectUI() {
        cleanupLegacyDuplicateUI();

        const parent = document.body || document.documentElement;
        if (!parent) return;

        let container = document.getElementById('mneos-gemini-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'mneos-gemini-container';
            parent.appendChild(container);
        }

        const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
        const currIdx = localStorage.getItem(ADA_INDEX_KEY) || '0';

        container.style.cssText = `
            position: fixed !important;
            right: 20px !important;
            bottom: 20px !important;
            top: auto !important;
            left: auto !important;
            z-index: 2147483647 !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            background: #0f172a !important;
            padding: 4px 10px !important;
            border-radius: 18px !important;
            border: 1.5px solid #a855f7 !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.85) !important;
            pointer-events: auto !important;
            gap: 6px !important;
        `;

        if (container.children.length === 0) {
            const vLabel = document.createElement('span');
            vLabel.id = 'mneos-version-label';
            vLabel.style.cssText = 'color: #a855f7; font-size: 11px; font-weight: bold; margin-right: 2px;';
            vLabel.textContent = '⚡ v5.2';

            const syncBtn = document.createElement('button');
            syncBtn.id = 'mneos-gemini-sync';
            syncBtn.textContent = '⚡ Sync';
            styleBtn(syncBtn, '#7c3aed');
            syncBtn.onclick = (e) => {
                e.preventDefault();
                harvestCurrentGeminiSession();
            };

            const sweepBtn = document.createElement('button');
            sweepBtn.id = 'mneos-gemini-sweep';
            sweepBtn.textContent = isActive ? `🛑 Stop Crawl (#${parseInt(currIdx, 10) + 1})` : '🚀 Crawl';
            styleBtn(sweepBtn, isActive ? '#ef4444' : '#059669');
            sweepBtn.onclick = (e) => {
                e.preventDefault();
                toggleAutoHarvest();
            };

            const resetBtn = document.createElement('button');
            resetBtn.id = 'mneos-gemini-reset';
            resetBtn.textContent = '🗑️ Reset';
            styleBtn(resetBtn, '#64748b');
            resetBtn.onclick = (e) => {
                e.preventDefault();
                localStorage.removeItem(VISITED_KEY);
                localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
                localStorage.setItem(ADA_INDEX_KEY, '0');
                updateStatus("Cache Cleared!");
                alert("MneOS Gemini visited session cache & sequence index cleared.");
                location.reload();
            };

            const statusLabel = document.createElement('span');
            statusLabel.id = 'mneos-gemini-status';
            statusLabel.style.cssText = 'color: #38bdf8; font-size: 10px; font-weight: bold; font-family: monospace; margin-left: 4px;';
            statusLabel.textContent = '';

            container.appendChild(vLabel);
            container.appendChild(syncBtn);
            container.appendChild(sweepBtn);
            container.appendChild(resetBtn);
            container.appendChild(statusLabel);
        } else {
            const sweepBtn = document.getElementById('mneos-gemini-sweep');
            if (sweepBtn) {
                sweepBtn.textContent = isActive ? `🛑 Stop Crawl (#${parseInt(currIdx, 10) + 1})` : '🚀 Crawl';
                sweepBtn.style.backgroundColor = isActive ? '#ef4444' : '#059669';
            }
        }
    }

    function updateStatus(msg) {
        const el = document.getElementById('mneos-gemini-status');
        if (el) el.textContent = msg;
    }

    function styleBtn(btn, bgColor) {
        btn.style.cssText = `
            padding: 6px 12px !important;
            background-color: ${bgColor} !important;
            color: #ffffff !important;
            border: 1px solid rgba(255,255,255,0.4) !important;
            border-radius: 6px !important;
            font-weight: 700 !important;
            font-size: 12px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            cursor: pointer !important;
            line-height: 1.4 !important;
        `;
    }

    async function discoverAdaSessions() {
        updateStatus("Unrolling Sidebar (0/100+)...");
        console.log("[MneOS Harvester v6.0] Starting Full Sidebar Unroll...");

        const openBtn = document.querySelector('button[aria-label="Open sidebar"]');
        if (openBtn) {
            openBtn.click();
            await new Promise(r => setTimeout(r, 800));
        }

        const recentsToggle = document.querySelector('button[aria-label="Toggle Recents"]');
        if (recentsToggle) {
            recentsToggle.click();
            await new Promise(r => setTimeout(r, 800));
        }

        let lastCount = 0;
        let sameStuck = 0;
        const MAX_STUCK_CHECKS = 8; // 8 checks * 1200ms = ~9.6 seconds of verified zero growth before ending

        for (let i = 0; i < 60; i++) {
            // Target all candidate scroll containers in Gemini side nav
            const scrollParents = document.querySelectorAll('.expandable-section-content-inner, .expandable-section-content, side-nav-history, side-nav, [role="navigation"], nav, .side-nav-content, [class*="history"]');
            scrollParents.forEach(el => {
                try {
                    el.scrollTop = el.scrollHeight || 999999;
                } catch(e) {}
            });

            // Click any expand / show more buttons
            const showMoreBtns = Array.from(document.querySelectorAll('button, a')).filter(el => {
                const txt = el.textContent.trim().toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                return (txt.includes('show more') || txt.includes('view more') || aria.includes('show more')) && !txt.includes('gems');
            });
            showMoreBtns.forEach(btn => {
                try { btn.click(); } catch(e) {}
            });

            // Allow 1200ms for Google's lazy-load network request to return and inject items
            await new Promise(r => setTimeout(r, 1200));

            const links = Array.from(document.querySelectorAll('a[href*="/app/"], a[href*="/c/"], a[href*="/chat/"]'));
            const currentCount = links.length;
            updateStatus(`Unrolling Sidebar (${currentCount} sessions)...`);

            if (currentCount > 0 && currentCount === lastCount) {
                sameStuck++;
                console.log(`[MneOS Harvester v6.0] Unroll check ${sameStuck}/${MAX_STUCK_CHECKS}: ${currentCount} sessions loaded.`);
                if (sameStuck >= MAX_STUCK_CHECKS) {
                    console.log(`[MneOS Harvester v6.0] ✅ Sidebar fully unrolled! Total sessions discovered: ${currentCount}`);
                    break;
                }
            } else {
                if (currentCount > lastCount) {
                    console.log(`[MneOS Harvester v6.0] 📜 Unroll expanded: ${lastCount} -> ${currentCount} sessions`);
                }
                sameStuck = 0;
                lastCount = currentCount;
            }
        }

        const links = Array.from(document.querySelectorAll('a[href*="/app/"], a[href*="/c/"], a[href*="/chat/"]'));
        const sessions = [];
        const seen = new Set();

        links.forEach(a => {
            const rawHref = a.getAttribute('href') || '';
            let cleanPath = rawHref.split('?')[0].split('#')[0];
            const parts = cleanPath.split('/').filter(Boolean);
            let rawId = parts[parts.length - 1] || '';

            // Extract pure session ID (alphanumeric hex string, removing any %2525 URL query params)
            const idMatch = rawId.match(/([a-f0-9]{12,64})/i);
            const id = idMatch ? idMatch[1] : null;

            if (!id || ['app', 'search', 'images', 'videos', 'gems', 'daily-brief'].includes(id)) return;
            if (seen.has(id)) return;
            seen.add(id);

            let title = a.getAttribute('aria-label') || a.textContent.trim().split('\n')[0] || 'Untitled Session';
            title = title.replace(/\s*-\s*Google.*/i, '').replace(/\s*-\s*Gemini.*/i, '').trim();

            sessions.push({
                index: sessions.length,
                title: title,
                id: id,
                href: `/app/${id}`
            });
        });

        console.log(`[MneOS Harvester v5.0] Discovered ${sessions.length} sessions via ADA Compliance Tree.`);
        return sessions;
    }

    let cachedAdaSessions = [];

    const ADA_SESSIONS_LIST_KEY = 'mneos_gemini_ada_sessions';

    function getStoredAdaSessions() {
        return getStorageJSON(ADA_SESSIONS_LIST_KEY, []);
    }

    function setStoredAdaSessions(list) {
        setStorageJSON(ADA_SESSIONS_LIST_KEY, list);
    }

    async function toggleAutoHarvest() {
        const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
        if (isActive) {
            localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
            updateStatus("Stopped.");
            alert("MneOS Gemini Auto-Harvest stopped.");
            location.reload();
            return;
        }

        localStorage.setItem(CRAWL_ACTIVE_KEY, 'true');
        localStorage.setItem(ADA_INDEX_KEY, '0');

        const sessions = await discoverAdaSessions();
        if (sessions.length === 0) {
            alert("No sessions discovered in ADA sidebar.");
            localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
            return;
        }

        setStoredAdaSessions(sessions);

        const target = sessions[0];
        console.log(`[MneOS Harvester v5.8] Auto-Harvest starting at Session #1 [Index 0]: ${target.title}`);
        if (location.pathname !== target.href) {
            window.location.href = target.href;
        } else {
            setTimeout(processCurrentAdaStep, 1500);
        }
    }

    function fetchHarvestedIds() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'http://127.0.0.1:3334/api/harvested-session-ids',
                onload: function(res) {
                    try {
                        const data = JSON.parse(res.responseText);
                        resolve(data.harvestedIds || []);
                    } catch(e) { resolve([]); }
                },
                onerror: function() { resolve([]); }
            });
        });
    }

    let isProcessingStep = false;

    async function processCurrentAdaStep() {
        const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
        if (!isActive || isProcessingStep) return;

        isProcessingStep = true;

        let sessions = getStoredAdaSessions();
        if (sessions.length === 0) {
            sessions = await discoverAdaSessions();
            setStoredAdaSessions(sessions);
        }

        let currentIndex = parseInt(localStorage.getItem(ADA_INDEX_KEY) || '0', 10);
        const harvestedIds = await fetchHarvestedIds();

        // Dynamically fast-forward past any sessions already rescued in the local vault!
        while (currentIndex < sessions.length) {
            const candidate = sessions[currentIndex];
            if (harvestedIds.includes(candidate.id)) {
                console.log(`[MneOS Harvester v6.1] ⏩ Session #${currentIndex + 1}/${sessions.length} ("${candidate.title}") already rescued in vault. Fast-forwarding.`);
                currentIndex++;
                localStorage.setItem(ADA_INDEX_KEY, String(currentIndex));
            } else {
                break;
            }
        }

        if (currentIndex >= sessions.length) {
            updateStatus("Re-checking sidebar...");
            console.log("[MneOS Harvester v6.2] Reached end of initial list. Re-unrolling sidebar to discover deep lazy-loaded sessions...");
            const freshSessions = await discoverAdaSessions();
            if (freshSessions.length > sessions.length) {
                console.log(`[MneOS Harvester v6.2] 📜 Discovered ${freshSessions.length - sessions.length} additional deep sessions! (Total: ${freshSessions.length})`);
                sessions = freshSessions;
                setStoredAdaSessions(sessions);
            } else {
                localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
                isProcessingStep = false;
                updateStatus("Harvest Complete! 🎉");
                const vaultTotal = (await fetchHarvestedIds()).length || sessions.length;
                alert(`🎉 MneOS Gemini ADA Rescue Complete! Total Vault Rescued: ${vaultTotal} sessions harvested & distilled.`);
                return;
            }
        }

        const target = sessions[currentIndex];
        updateStatus(`Processing (${currentIndex + 1}/${sessions.length}): "${target.title.substring(0, 15)}..."`);
        console.log(`[MneOS Harvester v6.3] Processing Session #${currentIndex + 1}/${sessions.length}: "${target.title}" (${target.href})`);

        if (location.pathname !== target.href) {
            isProcessingStep = false;
            window.location.href = target.href;
            return;
        }

        await harvestCurrentGeminiSession(async (success) => {
            const nextIndex = currentIndex + 1;
            localStorage.setItem(ADA_INDEX_KEY, String(nextIndex));

            if (nextIndex < sessions.length) {
                const nextTarget = sessions[nextIndex];
                console.log(`[MneOS Harvester v6.3] Advancing to Session #${nextIndex + 1}/${sessions.length}: "${nextTarget.title}"`);
                setTimeout(() => {
                    isProcessingStep = false;
                    window.location.href = nextTarget.href;
                }, 1500);
            } else {
                localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
                isProcessingStep = false;
                updateStatus("Harvest Complete! 🎉");
                const vaultTotal = (await fetchHarvestedIds()).length || sessions.length;
                alert(`🎉 MneOS Gemini ADA Rescue Complete! Total Vault Rescued: ${vaultTotal} sessions harvested & distilled.`);
            }
        });
    }

    async function waitForGeminiDOMHydration(timeoutMs = 12000) {
        updateStatus("Waiting for chat DOM...");
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const turns = extractGeminiDOMTurns();
            if (turns.length > 0) {
                console.log(`[MneOS Harvester v5.8] Chat DOM hydrated with ${turns.length} turns in ${Date.now() - start}ms.`);
                return turns;
            }
            await new Promise(r => setTimeout(r, 600));
        }
        console.warn("[MneOS Harvester v5.8] DOM hydration timeout reached.");
        return extractGeminiDOMTurns();
    }

    async function autoUnrollFullHistory() {
        console.log("[MneOS Harvester v5.8] Beginning Auto-Top-Scroll Unroll...");
        await waitForGeminiDOMHydration(12000);
        updateStatus("Unrolling to top...");
        
        let lastTurnCount = 0;
        let sameCountStuck = 0;
        const STABILITY_THRESHOLD = 6; // Requires 6 consecutive zero-growth checks to guarantee top is reached

        for (let i = 0; i < 300; i++) {
            // Scroll window and all inner scrollable containers to top
            window.scrollTo(0, 0);
            const scrollContainers = document.querySelectorAll('main, .chat-history, .conversation-container, [class*="scroll"], [role="main"], article');
            scrollContainers.forEach(c => {
                try { c.scrollTop = 0; } catch(e) {}
            });

            await new Promise(r => setTimeout(r, 600));

            const turns = extractGeminiDOMTurns();
            const currentCount = turns.length;
            updateStatus(`Unrolling (${currentCount} turns, check ${sameCountStuck}/${STABILITY_THRESHOLD})...`);

            if (currentCount > 0 && currentCount === lastTurnCount) {
                sameCountStuck++;
                if (sameCountStuck >= STABILITY_THRESHOLD) {
                    console.log(`[MneOS Harvester v5.8] Top of chat verified after ${STABILITY_THRESHOLD} consecutive checks (${currentCount} turns total).`);
                    break;
                }
            } else if (currentCount > 0) {
                if (currentCount > lastTurnCount) {
                    console.log(`[MneOS Harvester v5.8] Unrolled additional turns: ${lastTurnCount} -> ${currentCount}`);
                }
                sameCountStuck = 0;
                lastTurnCount = currentCount;
            }
        }

        return extractGeminiDOMTurns();
    }

    async function harvestCurrentGeminiSession(onCompleteCallback) {
        if (location.href.includes('/search')) {
            if (typeof onCompleteCallback === 'function') onCompleteCallback(false);
            return;
        }

        const sessionTitle = getGeminiTitle();
        const sessionId = getGeminiSessionId();

        if (isExcludedTitleOrId(sessionTitle) || isExcludedTitleOrId(sessionId)) {
            console.log(`[MneOS Harvester v5.0] Session "${sessionTitle}" matches Media/Image exclusion filter. Bypassing save.`);
            markVisited(sessionId);
            markVisited(location.href);
            updateStatus("Bypassed (Media Filter)");
            if (typeof onCompleteCallback === 'function') onCompleteCallback(true);
            return;
        }

        updateStatus("Unrolling & Harvesting...");
        const turns = await autoUnrollFullHistory();

        const validTurns = turns.filter(t => !isUiBoilerplateText(t.text));

        if (validTurns.length === 0) {
            console.warn("[MneOS Harvester v5.0] 0 valid conversation turns found. Bypassing payload submission.");
            markVisited(sessionId);
            markVisited(location.href);
            updateStatus("Bypassed (0 Turns)");
            if (typeof onCompleteCallback === 'function') onCompleteCallback(true);
            return;
        }

        markVisited(sessionId);
        markVisited(location.href);

        const payload = {
            platform: 'GEMINI',
            sessionId: sessionId,
            sessionTitle: sessionTitle,
            url: location.href,
            timestamp: new Date().toISOString(),
            turnCount: validTurns.length,
            turns: validTurns
        };

        console.log(`[MneOS Harvester v5.6] Harvesting Session: "${sessionTitle}" (${validTurns.length} turns)`);
        updateStatus(`Saving: "${sessionTitle.substring(0, 15)}..."`);

        GM_xmlhttpRequest({
            method: 'POST',
            url: DAEMON_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: function(response) {
                console.log("[MneOS Harvester v5.6] Daemon sync response:", response.responseText);
                try {
                    const res = JSON.parse(response.responseText);
                    if (res && res.suggested_smart_title) {
                        const smartTitle = res.suggested_smart_title;
                        console.log(`[MneOS Harvester v5.6] 🧠 Brita Smart Title: "${smartTitle}"`);
                        
                        const activeEl = document.querySelector('side-nav-entry[selected], a[aria-current="page"], [data-test-id="history-item"][aria-selected="true"], .nav-item-active');
                        if (activeEl) {
                            const titleNode = activeEl.querySelector('.conversation-title, .text-content, [class*="title"]') || activeEl;
                            if (titleNode && titleNode.children.length === 0) {
                                titleNode.textContent = smartTitle;
                            }
                            activeEl.setAttribute('aria-label', smartTitle);
                            activeEl.setAttribute('title', smartTitle);
                        }
                        updateStatus(`Saved & Synced: "${smartTitle.substring(0, 15)}..."`);
                    }
                } catch(e) {}

                updateStatus("Saved to Vault! ⚡");
                if (typeof onCompleteCallback === 'function') onCompleteCallback(true);
            },
            onerror: function(err) {
                console.error("[MneOS Harvester v5.6] Daemon sync failed:", err);
                updateStatus("Sync Error ❌");
                if (typeof onCompleteCallback === 'function') onCompleteCallback(false);
            }
        });
    }

    function getGeminiTitle() {
        const currentPath = location.pathname;
        const activeLink = document.querySelector(`a[href*="${currentPath}"]`);
        if (activeLink && activeLink.textContent.trim()) {
            let titleText = activeLink.textContent.trim().split('\n')[0];
            if (titleText && !isUiBoilerplateText(titleText) && titleText.length > 1) {
                return titleText;
            }
        }

        const selectors = [
            '[data-test-id="conversation-title"]',
            'header h1',
            '.conversation-title',
            'mat-toolbar h1',
            'h1'
        ];
        for (let sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim()) {
                let raw = el.textContent.trim();
                raw = raw.replace(/\s*-\s*Google.*/i, '')
                         .replace(/\s*-\s*Gemini.*/i, '')
                         .replace(/^Google/i, '')
                         .replace(/^Gemini/i, '')
                         .trim();
                if (raw && !isUiBoilerplateText(raw) && raw.length > 1) {
                    return raw;
                }
            }
        }

        let docTitle = document.title.replace(/\s*-\s*Google.*/i, '').replace(/\s*-\s*Gemini.*/i, '').trim();
        return docTitle || `Gemini_Session_${Date.now()}`;
    }

    function getGeminiSessionId() {
        const parts = location.pathname.split('/');
        return parts[parts.length - 1] || `gemini_${Date.now()}`;
    }

    function extractGeminiDOMTurns() {
        const turns = [];

        let candidates = Array.from(document.querySelectorAll('user-query, model-response'));

        if (candidates.length === 0) {
            candidates = Array.from(document.querySelectorAll('[data-test-id="user-query"], [data-test-id="model-response"]'));
        }

        if (candidates.length === 0) {
            candidates = Array.from(document.querySelectorAll('message-content'));
        }

        const cleanCandidates = candidates.filter(el => {
            return !el.closest('#mneos-gemini-container') && !el.closest('[id^="mneos-"]');
        });

        const topLevelNodes = cleanCandidates.filter(el => {
            return !cleanCandidates.some(other => other !== el && other.contains(el));
        });

        topLevelNodes.forEach((el) => {
            const tagName = el.tagName.toLowerCase();
            const className = el.className ? el.className.toString().toLowerCase() : '';
            const isUser = tagName.includes('user') || el.matches('[data-test-id*="user"]') || className.includes('user');
            const speaker = isUser ? 'USER' : 'GEMINI';
            
            let text = el.textContent ? el.textContent.trim() : '';

            text = text.replace(/^You said\s*/i, '')
                       .replace(/^Gemini said\s*/i, '')
                       .trim();

            if (text && text.length > 2 && !isUiBoilerplateText(text)) {
                if (turns.length > 0 && turns[turns.length - 1].speaker === speaker && turns[turns.length - 1].text === text) {
                    return;
                }
                turns.push({
                    turnIndex: turns.length + 1,
                    speaker: speaker,
                    text: text
                });
            }
        });

        return turns;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI);
    } else {
        injectUI();
    }

    setInterval(() => {
        injectUI();

        if (location.href !== lastObservedUrl) {
            lastObservedUrl = location.href;
            console.log("[MneOS Harvester v5.6] SPA Route Changed to:", location.href);

            const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
            if (isActive) {
                setTimeout(processCurrentAdaStep, 2000);
            }
        }
    }, 1000);

    const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
    if (isActive) {
        setTimeout(processCurrentAdaStep, 2500);
    }

})();

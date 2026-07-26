// ==UserScript==
// @name         MneOS Sovereign Gemini Vault Harvester v3.9
// @namespace    http://mneos.ai/
// @version      3.9
// @description  Gemini Vault Harvester with Precise Media Generation Filter & Tech Keyword Vault Routing
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

    // Quiet console suppressor for DevTools noise, CSP errors, WebGPU & Google telemetry logs across both Sandbox and UnsafeWindow contexts
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

    // High-Precision Media / Image / Video Generation Exclusion Patterns
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
        'waiting for turns'
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

    console.log("[MneOS Gemini Harvester v3.9] Initialized with Precise Media Exclusion & Tech Routing.");

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

        container.style.cssText = `
            position: fixed !important;
            top: 70px !important;
            right: 20px !important;
            z-index: 2147483647 !important;
            display: flex !important;
            gap: 8px !important;
            align-items: center !important;
            background: #0f172a !important;
            padding: 8px 14px !important;
            border-radius: 10px !important;
            border: 2px solid #6366f1 !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.85) !important;
            pointer-events: auto !important;
        `;

        if (container.children.length === 0) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'mneos-gemini-sync';
            syncBtn.textContent = '⚡ Sync Current Session';
            styleBtn(syncBtn, '#6366f1');
            syncBtn.onclick = (e) => {
                e.preventDefault();
                harvestCurrentGeminiSession();
            };

            const sweepBtn = document.createElement('button');
            sweepBtn.id = 'mneos-gemini-sweep';
            const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
            sweepBtn.textContent = isActive ? '🛑 Stop Crawl' : '🚀 Auto-Harvest All Chats';
            styleBtn(sweepBtn, isActive ? '#ef4444' : '#10b981');
            sweepBtn.onclick = (e) => {
                e.preventDefault();
                toggleAutoHarvest();
            };

            const resetBtn = document.createElement('button');
            resetBtn.id = 'mneos-gemini-reset';
            resetBtn.textContent = '🗑️ Reset Cache';
            styleBtn(resetBtn, '#64748b');
            resetBtn.onclick = (e) => {
                e.preventDefault();
                localStorage.removeItem(VISITED_KEY);
                localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
                updateStatus("Cache Cleared!");
                alert("MneOS Gemini visited session cache cleared.");
                location.reload();
            };

            const statusLabel = document.createElement('span');
            statusLabel.id = 'mneos-gemini-status';
            statusLabel.style.cssText = 'color: #38bdf8; font-size: 11px; font-weight: bold; font-family: monospace; margin-left: 4px;';
            statusLabel.textContent = '';

            container.appendChild(syncBtn);
            container.appendChild(sweepBtn);
            container.appendChild(resetBtn);
            container.appendChild(statusLabel);
        } else {
            const sweepBtn = document.getElementById('mneos-gemini-sweep');
            if (sweepBtn) {
                const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
                sweepBtn.textContent = isActive ? '🛑 Stop Crawl' : '🚀 Auto-Harvest All Chats';
                sweepBtn.style.backgroundColor = isActive ? '#ef4444' : '#10b981';
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

    function isGeminiSessionUrl(url) {
        if (!url) return false;
        try {
            const parsed = new URL(url, 'https://gemini.google.com');
            if (parsed.hostname !== 'gemini.google.com') return false;
            const path = parsed.pathname.trim();
            const parts = path.split('/').filter(Boolean);
            if (parts.length >= 2 && ['app', 'c', 'chat', 'b'].includes(parts[0])) {
                if (!['search', 'faq', 'settings', 'updates', 'advanced'].includes(parts[1])) {
                    return true;
                }
            }
            return false;
        } catch(e) {
            return false;
        }
    }

    function discoverSearchResultItems() {
        const items = [];
        const candidates = Array.from(document.querySelectorAll('a, div[role="button"], div[role="option"], li, conversation-item, [class*="result-item"], [class*="conversation-item"], [data-test-id*="search-result"]'));
        
        candidates.forEach(el => {
            if (el.closest('#mneos-gemini-container') || el.closest('[id^="mneos-"]')) return;

            const anchor = el.tagName === 'A' ? el : el.querySelector('a');
            let href = anchor ? (anchor.getAttribute('href') || anchor.href) : (el.getAttribute('href') || el.getAttribute('data-href'));
            
            if (!href) {
                const attrStr = Array.from(el.attributes).map(attr => attr.value).join(' ');
                const match = attrStr.match(/\/(app|c|chat|b)\/([a-zA-Z0-9_\-]+)/);
                if (match) href = match[0];
            }

            let fullUrl = null;
            if (href) {
                fullUrl = href.startsWith('http') ? href : `https://gemini.google.com${href.startsWith('/') ? '' : '/'}${href}`;
            }

            const text = el.textContent ? el.textContent.trim() : '';
            const title = text.split('\n')[0];

            if (isExcludedTitleOrId(title) || isExcludedTitleOrId(fullUrl) || isUiBoilerplateText(title)) {
                return;
            }

            if (fullUrl && isGeminiSessionUrl(fullUrl)) {
                items.push({ type: 'link', url: fullUrl, element: el, id: fullUrl, title: title });
            } else if (text.length > 5 && !text.includes("Search chats") && (text.includes("202") || text.includes("Jan") || text.includes("Feb") || text.includes("Mar") || text.includes("Apr") || text.includes("May") || text.includes("Jun") || text.includes("Jul") || text.includes("Aug") || text.includes("Sep") || text.includes("Oct") || text.includes("Nov") || text.includes("Dec"))) {
                items.push({ type: 'click', element: el, title: title, id: title });
            }
        });

        return items;
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

        if (!location.href.includes('/search')) {
            location.href = 'https://gemini.google.com/search';
            return;
        }

        runAutoHarvest();
    }

    async function runAutoHarvest() {
        console.log("[MneOS Harvester v3.9] Auto-Harvest scanning for next unvisited card...");
        updateStatus("Scanning cards...");

        await new Promise(r => setTimeout(r, 2000));

        const allItems = discoverSearchResultItems();
        
        const unvisitedItems = allItems.filter(item => !isVisited(item.id) && !isExcludedTitleOrId(item.title));

        const visitedCount = allItems.length - unvisitedItems.length;

        if (allItems.length === 0) {
            updateStatus("No cards found in DOM");
            alert("No session cards found in DOM. Please make sure search results or recents are visible.");
            localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
            return;
        }

        if (unvisitedItems.length === 0) {
            localStorage.setItem(CRAWL_ACTIVE_KEY, 'false');
            updateStatus("All Cards Harvested! 🎉");
            alert(`🎉 MneOS Gemini Auto-Harvest Complete! All ${allItems.length} sessions harvested.`);
            return;
        }

        const target = unvisitedItems[0];

        if (isExcludedTitleOrId(target.title) || isExcludedTitleOrId(target.id)) {
            console.log(`[MneOS Harvester v3.9] Bypassing Media/Image card: "${target.title}"`);
            markVisited(target.id);
            setTimeout(runAutoHarvest, 500);
            return;
        }

        updateStatus(`Crawling (${visitedCount + 1}/${allItems.length})...`);
        console.log(`[MneOS Harvester v3.9] Processing card [${visitedCount + 1}/${allItems.length}]: "${target.title || target.id}"`);

        markVisited(target.id);
        
        try {
            if (target.type === 'link' && target.url) {
                window.location.href = target.url;
            } else {
                target.element.click();
            }
        } catch(e) {
            console.warn("[MneOS Harvester v3.9] Card click exception swallowed safely:", e);
        }
    }

    async function waitForSessionDOMStabilization(maxWaitMs = 10000) {
        const startTime = Date.now();
        let lastCount = 0;
        let stableHits = 0;

        while (Date.now() - startTime < maxWaitMs) {
            const turns = extractGeminiDOMTurns();
            const currentCount = turns.length;
            updateStatus(`Stabilizing DOM (${currentCount} turns)...`);

            if (currentCount > 0 && currentCount === lastCount) {
                stableHits++;
                if (stableHits >= 2) {
                    console.log(`[MneOS Harvester v3.9] DOM stabilized with ${currentCount} turns.`);
                    return turns;
                }
            } else if (currentCount > 0) {
                stableHits = 0;
            }

            lastCount = currentCount;
            await new Promise(r => setTimeout(r, 1000));
        }

        let fallbackTurns = extractGeminiDOMTurns();
        return fallbackTurns;
    }

    async function harvestCurrentGeminiSession() {
        if (location.href.includes('/search')) return;

        const sessionTitle = getGeminiTitle();
        const sessionId = getGeminiSessionId();

        if (isExcludedTitleOrId(sessionTitle) || isExcludedTitleOrId(sessionId)) {
            console.log(`[MneOS Harvester v3.9] Session "${sessionTitle}" matches Media/Image exclusion filter. Bypassing save.`);
            markVisited(sessionId);
            markVisited(location.href);
            updateStatus("Bypassed (Media Filter)");
            if (localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true') {
                setTimeout(() => { window.location.href = 'https://gemini.google.com/search'; }, 1500);
            }
            return;
        }

        updateStatus("Waiting for turns...");
        const turns = await waitForSessionDOMStabilization(10000);

        const validTurns = turns.filter(t => !isUiBoilerplateText(t.text));

        if (validTurns.length === 0) {
            console.warn("[MneOS Harvester v3.9] 0 valid conversation turns found. Bypassing payload submission.");
            markVisited(sessionId);
            markVisited(location.href);
            updateStatus("Bypassed (0 Turns)");
            if (localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true') {
                setTimeout(() => { window.location.href = 'https://gemini.google.com/search'; }, 1500);
            }
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

        console.log(`[MneOS Harvester v3.9] Harvesting Session: "${sessionTitle}" (${validTurns.length} turns)`);
        updateStatus(`Saving: "${sessionTitle.substring(0, 15)}..."`);

        GM_xmlhttpRequest({
            method: 'POST',
            url: DAEMON_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: function(response) {
                console.log("[MneOS Harvester v3.9] Daemon sync response:", response.responseText);
                updateStatus("Saved to Vault! ⚡");

                if (localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true') {
                    console.log("[MneOS Harvester v3.9] Session saved. Returning to search page for next card...");
                    setTimeout(() => {
                        window.location.href = 'https://gemini.google.com/search';
                    }, 2000);
                }
            },
            onerror: function(err) {
                console.error("[MneOS Harvester v3.9] Daemon sync failed:", err);
                updateStatus("Sync Error ❌");
                if (localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true') {
                    setTimeout(() => { window.location.href = 'https://gemini.google.com/search'; }, 2000);
                }
            }
        });
    }

    function getGeminiTitle() {
        const titleEl = document.querySelector('header h1, title, [data-test-id="conversation-title"], h1, .conversation-title, [class*="conversation-title"]');
        let raw = titleEl ? titleEl.textContent.trim() : document.title;
        raw = raw.replace(/\s*-\s*Google.*/i, '')
                 .replace(/\s*-\s*Gemini.*/i, '')
                 .replace(/^Google/i, '')
                 .replace(/^Gemini/i, '')
                 .trim();
        return raw || `Gemini_Session_${Date.now()}`;
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
            console.log("[MneOS Harvester v3.9] SPA Route Changed to:", location.href);

            const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
            if (isActive) {
                if (location.href.includes('/search')) {
                    setTimeout(runAutoHarvest, 1500);
                } else {
                    setTimeout(harvestCurrentGeminiSession, 2500);
                }
            } else if (!location.href.includes('/search')) {
                setTimeout(harvestCurrentGeminiSession, 2000);
            }
        }
    }, 1000);

    const isActive = localStorage.getItem(CRAWL_ACTIVE_KEY) === 'true';
    if (isActive) {
        if (location.href.includes('/search')) {
            setTimeout(runAutoHarvest, 1500);
        } else {
            setTimeout(harvestCurrentGeminiSession, 2500);
        }
    }

})();

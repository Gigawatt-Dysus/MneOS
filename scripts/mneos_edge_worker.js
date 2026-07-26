/**
 * MneOS Sovereign Edge Worker (api.mne-os.com)
 * Cloudflare Worker / Vercel Edge Proxy for Memory Retrieval & Session Ingestion
 * Domain: https://api.mne-os.com
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Fallback index data mirror for edge caching
let cachedMetaIndex = null;
let lastCacheFetch = 0;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle OPTIONS Preflight for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }

    // Endpoint: /health
    if (url.pathname === '/health' || url.pathname === '/v1/health') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'MneOS Sovereign Edge Proxy',
        domain: 'api.mne-os.com',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Endpoint: /v1/hypersearch
    if (request.method === 'POST' && (url.pathname === '/v1/hypersearch' || url.pathname === '/api/hypersearch')) {
      try {
        const body = await request.json();
        const queryStr = (body.query || '').trim().toLowerCase();

        if (!queryStr) {
          return new Response(JSON.stringify({ status: 'error', message: 'Query is required' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        const terms = queryStr.split(/[\s,]+/).filter(t => t.length > 1);

        // Fetch Google Drive Public/Shared Master Index JSON if configured in ENV
        let metaIndex = cachedMetaIndex;
        const now = Date.now();
        if (!metaIndex || (now - lastCacheFetch > 300000)) { // 5 min cache
          const indexUrl = env.VAULT_INDEX_URL || 'https://raw.githubusercontent.com/DevDysus/MneOS/main/_SESSION_EXPORTS/00_MASTER_META_INDEX.json';
          try {
            const res = await fetch(indexUrl);
            if (res.ok) {
              metaIndex = await res.json();
              cachedMetaIndex = metaIndex;
              lastCacheFetch = now;
            }
          } catch (e) {
            console.warn('Could not fetch remote index:', e.message);
          }
        }

        if (!metaIndex || !Array.isArray(metaIndex)) {
          return new Response(JSON.stringify({
            status: 'success',
            matched_filename: '00_ROOT_INDEX.md',
            injected_block: `[MNEOS SOVEREIGN EDGE SEARCH]
Query: "${queryStr}"
Instruction: Query Google Drive "MneOS_Memory_Vault/00_ROOT_INDEX.md" for exact historical records matching "${queryStr}".`
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        // Score matches against keywords and summaries
        const scored = metaIndex.map(item => {
          let score = 0;
          const fullText = (item.filename + ' ' + (item.unbounded_keyword_index || []).join(' ') + ' ' + (item.cliffs_notes_summary || '')).toLowerCase();
          terms.forEach(term => {
            if (fullText.includes(term)) score += 5;
            if (item.filename.toLowerCase().includes(term)) score += 3;
          });
          return { item, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
          return new Response(JSON.stringify({ status: 'not_found', message: `No memory found for "${queryStr}".` }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        const top = scored[0].item;
        const injectedBlock = `[MNEOS SOVEREIGN EDGE MEMORY RETRIEVED]
Source File: ${top.filename}
Date: ${top.date}
Category: ${top.session_category}
Summary: ${top.cliffs_notes_summary}
Keywords: ${(top.unbounded_keyword_index || []).join(', ')}
Agreements & Lore: ${(top.core_agreements_and_lore || []).join('; ')}
[END MNEOS MEMORY RETRIEVAL]`;

        return new Response(JSON.stringify({
          status: 'success',
          matched_filename: top.filename,
          injected_block: injectedBlock
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: err.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    // Endpoint: /v1/save-session
    if (request.method === 'POST' && (url.pathname === '/v1/save-session' || url.pathname === '/api/save-session')) {
      try {
        const payload = await request.json();
        console.log(`[MneOS Edge Worker] Received harvested session payload: "${payload.sessionTitle}"`);
        
        // If webhooks or proxy backend configured in ENV, forward payload asynchronously
        if (env.ALPHA_NODE_WEBHOOK) {
          ctx.waitUntil(fetch(env.ALPHA_NODE_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }));
        }

        return new Response(JSON.stringify({
          status: 'success',
          message: 'Session payload ingested at edge',
          filename: `${payload.platform || 'GROK'}_Session_${payload.sessionTitle}_${new Date().toISOString().split('T')[0]}.md`
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ status: 'error', message: err.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('MneOS Sovereign Edge Proxy - Route Not Found', {
      status: 404,
      headers: CORS_HEADERS
    });
  }
};

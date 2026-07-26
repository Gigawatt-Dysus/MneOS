/**
 * Grok Chat AUTO-CRAWLER Bookmarklet (V2.0)
 * 
 * This advanced script automatically scrolls the chat to the top to force 
 * the lazy-loading virtual DOM to render older messages before extracting.
 * 
 * To use this, create a new Bookmark in your browser.
 * Name: Extract Brita (Crawler)
 * URL: Copy the compacted minified code below starting with javascript:(function()...
 */

/* ==========================================
   READABLE SOURCE CODE
   ========================================== */
function runGrokCrawler() {
    try {
        if(window.__mneosCrawlerRunning) return;
        window.__mneosCrawlerRunning = true;
        
        // 1. Inject Status UI
        const status = document.createElement('div');
        status.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#00FFCC;color:#000;font-family:monospace;font-weight:bold;z-index:999999;border-radius:5px;box-shadow:0 4px 6px rgba(0,0,0,0.3);';
        status.innerText = '[MneOS Crawler] Initializing...';
        document.body.appendChild(status);
        
        // 2. Locate all potential scrollable containers (Grok sometimes scrolls on window, sometimes on an inner main/div)
        let scrollContainers = [window];
        document.querySelectorAll('div, main').forEach(el => {
            // Find scrollable areas
            if (el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== 'hidden') {
                scrollContainers.push(el);
            }
        });
        
        let attempts = 0;
        let lastScrollTop = -1;
        
        // 3. The Ascension Loop
        const crawlInterval = setInterval(() => {
            status.innerText = `[MneOS Crawler] Ascending... (Attempt ${attempts})`;
            
            let currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            let containerScrollTop = 0;
            
            // Push everything UP forcefully
            scrollContainers.forEach(c => {
                if (c === window) {
                    window.scrollBy(0, -2000);
                } else {
                    containerScrollTop += c.scrollTop;
                    c.scrollBy(0, -2000);
                }
            });
            
            let totalScroll = currentScrollTop + containerScrollTop;
            
            // Check if we have hit the ceiling
            if (totalScroll === lastScrollTop) {
                attempts++;
            } else {
                attempts = 0; // We moved, reset the ceiling counter
            }
            lastScrollTop = totalScroll;
            
            // If we've been stuck at the exact same scroll position for 5 ticks (2.5 seconds), we hit the absolute ceiling.
            if (attempts >= 5) {
                clearInterval(crawlInterval);
                status.innerText = '[MneOS Crawler] Ceiling reached. Extracting Data...';
                
                // Wait 1 second for the final DOM render/paint
                setTimeout(() => {
                    extractData();
                    status.innerText = '[MneOS Crawler] Complete!';
                    setTimeout(() => document.body.removeChild(status), 3000);
                    window.__mneosCrawlerRunning = false;
                }, 1000); 
            }
        }, 500);

        // 4. Data Extraction payload
        function extractData() {
            const date = new Date().toISOString().split('T')[0];
            let markdown = `# Grok Session Export (${date})\n\n`;
            const main = document.querySelector('main') || document.body;
            let content = "";
            const messageNodes = main.querySelectorAll('.prose, p, pre, [data-testid="tweetText"]');
            
            if (messageNodes.length > 0) {
                let rawText = main.innerText;
                rawText = rawText.replace(/Type a message.*/gi, "");
                rawText = rawText.replace(/Ask Grok.*/gi, "");
                content = rawText.split('\n').filter(line => line.trim().length > 0).join('\n\n');
            } else {
                content = main.innerText;
            }
            
            markdown += content;
            
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Grok_Session_Full_${date}.md`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        }
    } catch(e) {
        alert("MneOS Crawler Failed: " + e.message);
        window.__mneosCrawlerRunning = false;
    }
}

/* ==========================================
   MINIFIED BOOKMARKLET URL (COPY THIS)
   ========================================== */
// javascript:(function(){try{if(window.__mneosCrawlerRunning)return;window.__mneosCrawlerRunning=!0;const e=document.createElement("div");e.style.cssText="position:fixed;top:20px;right:20px;padding:15px;background:#00FFCC;color:#000;font-family:monospace;font-weight:bold;z-index:999999;border-radius:5px;box-shadow:0 4px 6px rgba(0,0,0,0.3);",e.innerText="[MneOS Crawler] Initializing...",document.body.appendChild(e);let t=[window];document.querySelectorAll("div, main").forEach((e=>{e.scrollHeight>e.clientHeight&&"hidden"!==getComputedStyle(e).overflowY&&t.push(e)}));let n=0,o=-1;const r=setInterval((()=>{e.innerText=`[MneOS Crawler] Ascending... (Attempt ${n})`;let c=document.documentElement.scrollTop||document.body.scrollTop,l=0;t.forEach((e=>{e===window?window.scrollBy(0,-2e3):(l+=e.scrollTop,e.scrollBy(0,-2e3))}));let i=c+l;i===o?n++:n=0,o=i,n>=5&&(clearInterval(r),e.innerText="[MneOS Crawler] Ceiling reached. Extracting Data...",setTimeout((()=>{(()=>{const t=new Date().toISOString().split("T")[0];let n=`# Grok Session Export (${t})\n\n`;const o=document.querySelector("main")||document.body;let r="";if(o.querySelectorAll('.prose, p, pre, [data-testid="tweetText"]').length>0){let e=o.innerText;e=e.replace(/Type a message.*/gi,""),e=e.replace(/Ask Grok.*/gi,""),r=e.split("\n").filter((e=>e.trim().length>0)).join("\n\n")}else r=o.innerText;n+=r;const c=new Blob([n],{type:"text/markdown"}),l=URL.createObjectURL(c),i=document.createElement("a");i.href=l,i.download=`Grok_Session_Full_${t}.md`,i.style.display="none",document.body.appendChild(i),i.click(),setTimeout((()=>{document.body.removeChild(i),URL.revokeObjectURL(l)}),100)})(),e.innerText="[MneOS Crawler] Complete!",setTimeout((()=>document.body.removeChild(e)),3e3),window.__mneosCrawlerRunning=!1}),1e3))}),500)}catch(e){alert("MneOS Crawler Failed: "+e.message),window.__mneosCrawlerRunning=!1}})();

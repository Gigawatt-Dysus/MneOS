/**
 * Grok Chat Exporter Bookmarklet
 * 
 * To use this, create a new Bookmark in your browser.
 * Name: Export Grok Session
 * URL: Copy the compacted minified code below starting with javascript:(function()...
 */

/* ==========================================
   READABLE SOURCE CODE
   ========================================== */
function exportGrokChat() {
    try {
        const date = new Date().toISOString().split('T')[0];
        let markdown = `# Grok Session Export (${date})\n\n`;

        // Strategy 1: Look for specific Grok UI elements (X.com or Grok.com)
        // Usually, chat bubbles are in a main container or have specific roles.
        const main = document.querySelector('main') || document.body;
        
        // We will try to find the chat message rows. 
        // On many modern React chat UIs, they are direct children of a flex column container.
        // A robust heuristic: find the deepest element that contains a significant amount of text.
        
        let content = "";
        
        // Let's do a smart extraction of all paragraphs and code blocks to maintain structure
        // If it's Grok, AI responses often use 'prose' or 'markdown' classes.
        const messageNodes = main.querySelectorAll('.prose, p, pre, [data-testid="tweetText"]');
        
        if (messageNodes.length > 0) {
            // But this might miss User messages if they aren't <p>.
            // Instead, getting the raw innerText of the main conversation area is often the cleanest fallback 
            // because the browser automatically formats it with line breaks.
            
            // Let's attempt to clean up the raw innerText
            let rawText = main.innerText;
            
            // Clean up navigation/junk if possible (heuristic: split by common footer/header text)
            // Grok often has "Type a message" or "Ask Grok" at the bottom.
            rawText = rawText.replace(/Type a message.*/gi, '');
            rawText = rawText.replace(/Ask Grok.*/gi, '');
            
            // Add some rudimentary formatting
            content = rawText.split('\n')
                .filter(line => line.trim().length > 0)
                .join('\n\n'); // double space for markdown paragraphs
                
        } else {
            content = main.innerText;
        }

        markdown += content;

        // Trigger Download
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Grok_Session_${date}.md`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        console.log("[MneOS] Grok Session Exported Successfully.");
    } catch (err) {
        console.error("[MneOS] Export Failed:", err);
        alert("MneOS Exporter Failed: " + err.message);
    }
}

/* ==========================================
   MINIFIED BOOKMARKLET URL
   ========================================== */
// javascript:(function(){try{const e=new Date().toISOString().split("T")[0];let t=`# Grok Session Export (${e})\n\n`;const n=document.querySelector("main")||document.body;let o="";const r=n.querySelectorAll('.prose, p, pre, [data-testid="tweetText"]');if(r.length>0){let e=n.innerText;e=e.replace(/Type a message.*/gi,""),e=e.replace(/Ask Grok.*/gi,""),o=e.split("\n").filter((e=>e.trim().length>0)).join("\n\n")}else o=n.innerText;t+=o;const c=new Blob([t],{type:"text/markdown"}),i=URL.createObjectURL(c),a=document.createElement("a");a.href=i,a.download=`Grok_Session_${e}.md`,a.style.display="none",document.body.appendChild(a),a.click(),setTimeout((()=>{document.body.removeChild(a),URL.revokeObjectURL(i)}),100),console.log("[MneOS] Grok Session Exported Successfully.")}catch(e){console.error("[MneOS] Export Failed:",e),alert("MneOS Exporter Failed: "+e.message)}})();

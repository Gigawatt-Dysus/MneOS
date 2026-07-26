import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";

// Ensure initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Fetch HTML from Hosting to ensure we have the hashed JS/CSS bundles
const BASE_URL = "https://gigiwatt.com";
const DEFAULT_IMAGE = "https://gigiwatt.com/assets/eric-headshot.png"; 

export const serveBiodata = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    try {
        const pathParts = req.path.split('/').filter(Boolean);
        // Prioritize 'ats' for recruiter flow, fallback to 'u'
        let slug = null;
        if (pathParts.includes('ats')) {
            const atsIndex = pathParts.indexOf('ats');
            slug = pathParts[atsIndex + 1];
        } else if (pathParts.includes('u')) {
            const uIndex = pathParts.indexOf('u');
            slug = pathParts[uIndex + 1];
        }

        if (!slug) {
            res.redirect('/');
            return;
        }

        // 1. Fetch user data by slug
        let user: admin.firestore.DocumentData | null = null;

        const slugSnap = await db.collection('public_slugs').doc(slug).get();
        if (slugSnap.exists) {
            const targetUserId = slugSnap.data()?.targetUserId;
            if (targetUserId) {
                const userSnap = await db.collection('users').doc(targetUserId).get();
                if (userSnap.exists) {
                    user = userSnap.data() || null;
                }
            }
        }

        // 2. Fetch Base HTML
        let htmlSnippet = "";
        try {
            // Include cache busting to ensure we are always grabbing the latest root HTML edges
            const response = await axios.get(BASE_URL + '/index.html?t=' + Date.now());
            htmlSnippet = response.data;
        } catch (e) {
            console.warn("Failed fetching live index.html. Falling back to default shell.", e);
            // Fallback minimalistic HTML to trigger client-side rendering if fetch fails
            htmlSnippet = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>GIGI ATS</title><script type="module" src="/src/index.tsx"></script></head><body><div id="root"></div></body></html>`;
        }

        // 3. Inject OpenGraph Tags
        if (user) {
            const displayName = user.displayName || user.name || 'Candidate';
            const title = `${displayName} - ATS Profile`;
            const description = user.bio || `View ${displayName}'s professional biodata extract securely on GIGI.`;
            const image = user.photoURL || DEFAULT_IMAGE;
            const url = `${BASE_URL}/u/${slug}`;

            const metaTags = `
                <title>${title}</title>
                <meta name="description" content="${description}">
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="${description}">
                <meta property="og:image" content="${image}">
                <meta property="og:url" content="${url}">
                <meta property="og:type" content="profile">
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="${title}">
                <meta name="twitter:description" content="${description}">
                <meta name="twitter:image" content="${image}">
            `;

            if (htmlSnippet.includes('</head>')) {
                 htmlSnippet = htmlSnippet.replace(/<title>.*?<\/title>/i, '');
                 htmlSnippet = htmlSnippet.replace('</head>', `${metaTags}\n</head>`);
            }
        } else {
            // 404 Case: let the React app handle the "Not Found" rendering
            const metaTags = `
                <title>Profile Not Found - GIGI ATS</title>
                <meta name="robots" content="noindex">
            `;
            if (htmlSnippet.includes('</head>')) {
                htmlSnippet = htmlSnippet.replace(/<title>.*?<\/title>/i, '');
                htmlSnippet = htmlSnippet.replace('</head>', `${metaTags}\n</head>`);
            }
        }

        // We explicitly tell browsers/crawlers to cache this specific profile briefly
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(htmlSnippet);

    } catch (error) {
        console.error("serveBiodata Interceptor Error:", error);
        res.redirect('/');
    }
});

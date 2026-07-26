import { useEffect } from 'react';
import { GOOGLE_FONTS_LIBRARY } from '../components/shared/fontData';

export const useFontLoader = (installedFonts: string[] = []) => {
    useEffect(() => {
        if (!installedFonts.length) return;

        // 1. Filter out system fonts (they don't need downloading)
        const googleFontsToLoad = installedFonts.filter(fontName =>
            GOOGLE_FONTS_LIBRARY.some(gf => gf.family === fontName)
        );

        if (googleFontsToLoad.length === 0) return;

        // 2. Construct the Google Fonts URL
        // Format: family=Roboto:wght@400;700&family=Lato...
        const fontParams = googleFontsToLoad
            .map(font => `family=${font.replace(/ /g, '+')}:wght@300;400;500;700`)
            .join('&');

        const linkId = 'gigi-dynamic-fonts';
        const url = `https://fonts.googleapis.com/css2?${fontParams}&display=swap`;

        // 3. Inject into Head
        let link = document.getElementById(linkId) as HTMLLinkElement;

        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }

        link.href = url;

    }, [installedFonts]); // Re-run whenever the deck changes
};
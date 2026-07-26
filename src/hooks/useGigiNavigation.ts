import { useState, useEffect, useRef } from 'react';
import type { View, Theme } from '../types';

export const useGigiNavigation = () => {
    const [currentView, setCurrentView] = useState<View>(() => {
        if (typeof window !== 'undefined' && window.location.pathname.includes('alexa-link')) {
            return 'alexaLink';
        }
        return 'dashboard';
    });
    const [viewData, setViewData] = useState<any>(null);

    // Tracks interaction for Idle Timer
    const lastInteractionTime = useRef(Date.now());

    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            return saved === 'light' ? 'light' : 'dark';
        }
        return 'dark';
    });

    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const navigate = (view: View, data?: any) => {
        // [ZEN GUARDIAN] History Sync
        if (typeof window !== 'undefined') {
            window.history.pushState({ view, data }, '', '');
        }

        setCurrentView(view);
        if (data) setViewData(data);
        else setViewData(null);

        lastInteractionTime.current = Date.now();
    };

    // [ZEN GUARDIAN] The Navigation Trap
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            // If the back button is hit and we have state, sync the view
            if (event.state && event.state.view) {
                setCurrentView(event.state.view);
                setViewData(event.state.data || null);
            } else {
                // If we've reached the bottom of the stack, stay put
                window.history.pushState({ view: currentView, data: viewData }, '', '');
            }
        };

        window.addEventListener('popstate', handlePopState);

        // Initialize the first state if it doesn't exist
        if (typeof window !== 'undefined' && (!window.history.state || !window.history.state.view)) {
            window.history.replaceState({ view: currentView, data: viewData }, '', '');
        }

        return () => window.removeEventListener('popstate', handlePopState);
        // We exclude currentView/viewData from dependencies to prevent the "refresh-loop" 
        // that occurs when the navigate function pushes state AND this effect tries to sync it.
    }, []);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    return {
        currentView,
        viewData,
        setViewData, // Exposed for cleaning
        theme,
        setTheme, // Exposed for cloud sync settings
        navigate,
        toggleTheme,
        lastInteractionTime
    };
};
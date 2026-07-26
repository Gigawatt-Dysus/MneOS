import { useState, useEffect, useRef } from 'react';
import type { View, Theme } from '@/types';

export const useGigiNavigation = () => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
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
        // Special logic: Clear Deep Dive query when leaving that specific view
        if (currentView === 'deepDiveReporter' && view !== 'deepDiveReporter') {
            // Handled in UI/AI hook via query reset, or we just rely on unmounting
        }
        setCurrentView(view);
        if (data) setViewData(data);
        else setViewData(null); // Clear data if none provided to prevent staleness
        
        lastInteractionTime.current = Date.now();
    };

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
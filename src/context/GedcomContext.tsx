
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GedcomData } from '../services/gedcom/types';

import { GedcomStorage } from '../services/storage/gedcomStorage';

interface GedcomContextType {
    gedcomData: GedcomData | null;
    filename: string | null;
    setGedcomData: (data: GedcomData | null, filename?: string) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    clearGedcom: () => void;
}

const GedcomContext = createContext<GedcomContextType | undefined>(undefined);

export const GedcomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gedcomData, setGedcomDataState] = useState<GedcomData | null>(null);
    const [filename, setFilename] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Start loading to check DB

    // [ZEN] Persistence: Load from IDB on mount
    React.useEffect(() => {
        const load = async () => {
            try {
                const stored = await GedcomStorage.load();
                if (stored) {
                    setGedcomDataState(stored.data);
                    setFilename(stored.filename);
                }
            } catch (e) {
                console.error("Failed to restore GEDCOM from storage", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const setGedcomData = (data: GedcomData | null, newFilename?: string) => {
        setGedcomDataState(data);
        if (data && newFilename) {
            setFilename(newFilename);
            GedcomStorage.save(data, newFilename).catch(console.error);
        }
    };

    const clearGedcom = () => {
        setGedcomDataState(null);
        setFilename(null);
        GedcomStorage.clear().catch(console.error);
    };

    return (
        <GedcomContext.Provider value={{ gedcomData, filename, setGedcomData, isLoading, setIsLoading, clearGedcom }}>
            {children}
        </GedcomContext.Provider>
    );
};

export const useGedcom = () => {
    const context = useContext(GedcomContext);
    if (!context) {
        throw new Error('useGedcom must be used within a GedcomProvider');
    }
    return context;
};

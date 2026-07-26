import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';

export interface WindowState {
  id: string;
  title: string;
  content: ReactNode;
  x: number;
  y: number;
  width: number | string;
  height: number | string;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
}

export type SerializedWindowState = Omit<WindowState, 'title' | 'content'>;

interface WindowManagerContextType {
  windows: WindowState[];
  openWindow: (id: string, title: string, content: ReactNode, defaultBounds?: Partial<WindowState>) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateBounds: (id: string, bounds: Partial<WindowState>) => void;
  toggleWindow: (id: string) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

const LS_KEY = 'mneos-window-geometry';

export const WindowManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(100);

  // Keep a ref of geometry to sync with localStorage without re-triggering hooks unnecessarily
  const savedGeometryRef = useRef<Record<string, Partial<WindowState>>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        savedGeometryRef.current = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load window geometry", e);
    }
  }, []);

  const saveGeometry = useCallback((id: string, bounds: Partial<WindowState>) => {
    savedGeometryRef.current = {
      ...savedGeometryRef.current,
      [id]: {
        ...savedGeometryRef.current[id],
        ...bounds
      }
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(savedGeometryRef.current));
    } catch (e) {
      console.error("Failed to save window geometry", e);
    }
  }, []);

  const openWindow = useCallback((id: string, title: string, content: ReactNode, defaultBounds?: Partial<WindowState>) => {
    setWindows(prev => {
      // If already open, just focus it
      if (prev.find(w => w.id === id)) {
        setTimeout(() => focusWindow(id), 0);
        return prev;
      }
      
      const saved = savedGeometryRef.current[id] || {};

      const safeWidth = (saved.width === 'auto' || Number.isNaN(saved.width)) ? null : saved.width;
      const safeHeight = (saved.height === 'auto' || Number.isNaN(saved.height)) ? null : saved.height;

      const rawY = saved.y ?? defaultBounds?.y ?? (window.innerHeight / 2) - 200;
      const safeY = Math.max(0, rawY);

      const newWindow: WindowState = {
        id,
        title,
        content,
        x: saved.x ?? defaultBounds?.x ?? (window.innerWidth / 2) - 300,
        y: safeY,
        width: safeWidth ?? defaultBounds?.width ?? 600,
        height: safeHeight ?? defaultBounds?.height ?? 400,
        zIndex: nextZIndex,
        isMinimized: saved.isMinimized ?? defaultBounds?.isMinimized ?? false,
        isMaximized: saved.isMaximized ?? defaultBounds?.isMaximized ?? false,
      };
      
      setNextZIndex(z => z + 1);
      return [...prev, newWindow];
    });
  }, [nextZIndex]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id && w.zIndex !== nextZIndex) {
        setNextZIndex(z => z + 1);
        return { ...w, zIndex: nextZIndex, isMinimized: false };
      }
      return w;
    }));
  }, [nextZIndex]);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        const isMinimized = !w.isMinimized;
        saveGeometry(id, { isMinimized });
        return { ...w, isMinimized };
      }
      return w;
    }));
  }, [saveGeometry]);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        const isMaximized = !w.isMaximized;
        saveGeometry(id, { isMaximized });
        return { ...w, isMaximized };
      }
      return w;
    }));
  }, [saveGeometry]);

  const updateBounds = useCallback((id: string, bounds: Partial<WindowState>) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, ...bounds } : w));
    saveGeometry(id, bounds);
  }, [saveGeometry]);

  const toggleWindow = useCallback((id: string) => {
    setWindows(prev => {
      const window = prev.find(w => w.id === id);
      if (!window) return prev;

      const maxZ = Math.max(0, ...prev.map(w => w.zIndex));
      
      if (window.isMinimized) {
        saveGeometry(id, { isMinimized: false });
        return prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: maxZ + 1 } : w);
      }
      
      const isFront = window.zIndex === maxZ;
      if (isFront) {
        saveGeometry(id, { isMinimized: true });
        return prev.map(w => w.id === id ? { ...w, isMinimized: true } : w);
      } else {
        return prev.map(w => w.id === id ? { ...w, zIndex: maxZ + 1 } : w);
      }
    });
    setNextZIndex(z => z + 1);
  }, [saveGeometry]);

  return (
    <WindowManagerContext.Provider value={{
      windows,
      openWindow,
      closeWindow,
      focusWindow,
      toggleMinimize,
      toggleMaximize,
      updateBounds,
      toggleWindow
    }}>
      {children}
    </WindowManagerContext.Provider>
  );
};

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
};

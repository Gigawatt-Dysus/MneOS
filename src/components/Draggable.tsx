import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface DraggableProps {
    children: ReactNode;
    initialPosition?: { x: number; y: number };
    className?: string;
    persistenceKey?: string; // [ZEN FIX] Save position
}

export const Draggable: React.FC<DraggableProps> = ({
    children,
    initialPosition = { x: 0, y: 0 },
    className = "",
    persistenceKey
}) => {
    // [ZEN FIX] Load from storage if available
    const [position, setPosition] = useState(() => {
        if (persistenceKey) {
            const saved = localStorage.getItem(persistenceKey);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) { console.error("Failed to parse drag pos", e); }
            }
        }
        return initialPosition;
    });

    // [ZEN FIX] Keep ref for event handlers to avoid stale closures
    const posRef = useRef(position);
    useEffect(() => { posRef.current = position; }, [position]);

    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const hasDragged = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        hasDragged.current = false; // Reset
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;

        if (Math.abs(newX - (e.clientX - dragStart.current.x)) > 5 || Math.abs(newY - (e.clientY - dragStart.current.y)) > 5) {
            // Moved enough
        }
        hasDragged.current = true;

        const maxX = window.innerWidth - 64;
        const maxY = window.innerHeight - 64;

        const clampedX = Math.max(0, Math.min(maxX, newX));
        const clampedY = Math.max(0, Math.min(maxY, newY));

        setPosition({ x: clampedX, y: clampedY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        // [ZEN FIX] Save from REF (Fresh)
        if (persistenceKey && posRef.current) {
            localStorage.setItem(persistenceKey, JSON.stringify(posRef.current));
        }
    };

    const handleClickCapture = (e: React.MouseEvent) => {
        if (hasDragged.current) {
            e.preventDefault();
            e.stopPropagation();
            hasDragged.current = false;
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Save position to effect whenever it changes? expensive. MouseUp is better.

    return (
        <div
            className={`fixed z-[100] cursor-grab active:cursor-grabbing ${className}`}
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(0, 0)', // Force GPU layer
            }}
            onMouseDown={handleMouseDown}
            onClickCapture={handleClickCapture}
        >
            {children}
        </div>
    );
};

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
    children: React.ReactNode;
}

/**
 * [PACT COMPLIANCE] React Portal implementation
 * Breaks out of parent stacking contexts to prevent Z-index "Chaos".
 */
export const Portal: React.FC<PortalProps> = ({ children }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // [ANTI-OVERLAP] Prevent body scrolling when portals are active
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = 'unset';
            setMounted(false);
        };
    }, []);

    return mounted ? createPortal(
        children,
        document.body
    ) : null;
};

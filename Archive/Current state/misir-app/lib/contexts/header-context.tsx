'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface HeaderContextValue {
    headerContent: ReactNode | null;
    setHeaderContent: (content: ReactNode | null) => void;
}

const HeaderContext = createContext<HeaderContextValue | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
    const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);

    return (
        <HeaderContext.Provider value={{ headerContent, setHeaderContent }}>
            {children}
        </HeaderContext.Provider>
    );
}

export function useHeader() {
    const context = useContext(HeaderContext);
    if (!context) {
        throw new Error('useHeader must be used within HeaderProvider');
    }
    return context;
}

/**
 * Hook to set header content from a page.
 * Content is cleared on unmount.
 */
export function usePageHeader(content: ReactNode) {
    const { setHeaderContent } = useHeader();

    // Set on mount, clear on unmount
    useState(() => {
        setHeaderContent(content);
        return () => setHeaderContent(null);
    });
}

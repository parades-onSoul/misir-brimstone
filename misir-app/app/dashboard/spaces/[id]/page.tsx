'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSpaceStore } from '@/lib/store';
import { SpaceBlobVisualization } from '@/components/space-blob-visualization';
import { SpaceOverviewSidebar } from '@/components/space-overview-sidebar';
import { Loader2 } from 'lucide-react';

export default function SpaceOverviewPage() {
    const params = useParams();
    const { spaces } = useSpaceStore();
    const [loading, setLoading] = useState(true);

    const space = spaces.find(s => s.id === params.id);

    useEffect(() => {
        // Give time for spaces to load if not yet loaded
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, [spaces]);

    if (loading && !space) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!space) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <h2 className="text-2xl font-semibold mb-2">Space not found</h2>
                <p className="text-muted-foreground">
                    This space doesn't exist or you don't have access to it.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full">
            {/* Main visualization area */}
            <div className="flex-1 relative">
                <SpaceBlobVisualization space={space} />
            </div>

            {/* Sidebar */}
            <SpaceOverviewSidebar space={space} />
        </div>
    );
}

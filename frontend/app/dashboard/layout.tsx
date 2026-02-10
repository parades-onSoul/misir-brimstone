'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { CreateSpaceModal } from '@/components/spaces/create-space-modal';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0B0C0E]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5E6AD2] border-t-transparent" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#0B0C0E] selection:bg-[#5E6AD2]/30">
            {/* Sidebar (Fixed 260px) */}
            <AppSidebar />

            {/* Main Content Area (Fluid) */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0B0C0E] relative overflow-hidden">
                {/* Scrollable Content Canvas */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>

            {/* Modals */}
            <CreateSpaceModal />
        </div>
    );
}

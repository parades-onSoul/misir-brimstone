'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <SidebarProvider
            defaultOpen={false}
            style={{ "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
        >
            <AppSidebar variant="sidebar" collapsible="icon" />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col bg-muted/40">
                    <main className="@container/main flex flex-1 flex-col gap-2">{children}</main>
                </div>
            </SidebarInset>
            <CreateSpaceModal />
        </SidebarProvider>
    );
}

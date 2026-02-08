'use client';

import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { MisirSectionCards } from '@/components/dashboard/misir-section-cards';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, LayoutGrid, Search } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const { data: spaces, isLoading, error } = useSpaces(user?.id);

    if (error) {
        return (
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <Alert variant="destructive" className="mx-4 lg:mx-6">
                    <AlertDescription>
                        Failed to load dashboard: {error.message}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">Welcome back</p>
                    <h1 className="text-2xl font-semibold tracking-tight">Your orientation at a glance</h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" className="gap-2" asChild>
                        <a href="/dashboard/search">
                            <Search className="h-4 w-4" />
                            Search
                        </a>
                    </Button>
                    <Button className="gap-2" asChild>
                        <a href="/dashboard">
                            <LayoutGrid className="h-4 w-4" />
                            New Space
                        </a>
                    </Button>
                </div>
            </div>

            <MisirSectionCards spaces={spaces} isLoading={isLoading} />
            
            <div className="px-4 lg:px-6 grid gap-4 lg:grid-cols-[2fr,1fr]">
                <Card className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Engagement over time</CardTitle>
                            <CardDescription>Trailing 90 days of capture activity</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
                            <a href="/dashboard/analytics">
                                View details
                                <ArrowRight className="h-3.5 w-3.5" />
                            </a>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ChartAreaInteractive />
                    </CardContent>
                </Card>

                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent activity</CardTitle>
                            <CardDescription>Last 7 days</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Artifact timeline and activity will appear here.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Shortcuts</CardTitle>
                            <CardDescription>Common flows</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 text-sm">
                            <Button variant="outline" className="justify-start gap-2" asChild>
                                <a href="/dashboard/search">
                                    <Search className="h-4 w-4" />
                                    Find artifacts
                                </a>
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" asChild>
                                <a href="/dashboard/analytics">
                                    <ArrowRight className="h-4 w-4" />
                                    View analytics
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

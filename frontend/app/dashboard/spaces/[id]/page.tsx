'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Plus, Search, MoreVertical, ExternalLink, Clock,
    Settings, FileText, Layers, Activity, Map,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSpace, useDeleteSpace, useSubspaces } from '@/lib/api/spaces';
import { useArtifacts } from '@/lib/api/artifacts';
import type { Artifact } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArtifactDetailModal } from '@/components/artifacts/artifact-detail-modal';
import { SpaceBlobVisualization } from '@/components/space-blob-visualization';
import { SpaceOverviewSidebar } from '@/components/spaces/space-overview-sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const engagementColors: Record<string, string> = {
    ambient: 'bg-gray-500/10 text-gray-400',
    engaged: 'bg-blue-500/10 text-blue-400',
    committed: 'bg-amber-500/10 text-amber-400',
};

type Tab = 'overview' | 'artifacts';

export default function SpaceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const spaceId = parseInt(params.id as string);

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: space, isLoading: spaceLoading } = useSpace(spaceId, user?.id);
    const { data: subspaces, isLoading: subspacesLoading } = useSubspaces(spaceId, user?.id);
    const { data: artifacts, isLoading: artifactsLoading } = useArtifacts(spaceId, user?.id);

    const filteredArtifacts = artifacts?.filter((a) =>
        (a.title?.toLowerCase() || a.url.toLowerCase()).includes(searchQuery.toLowerCase())
    );

    const { mutate: deleteSpace, isPending: isDeleting } = useDeleteSpace();

    const handleDeleteSpace = () => {
        if (!user) return;
        if (confirm('Are you sure you want to delete this space? This action cannot be undone.')) {
            deleteSpace(spaceId, {
                    onSuccess: () => router.push('/dashboard'),
                    onError: (error) => {
                        console.error('Failed to delete space:', error);
                        alert('Failed to delete space');
                    }
                }
            );
        }
    };

    // Compute stats
    const lastArtifact = artifacts?.length
        ? [...artifacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

    const engagementBreakdown = artifacts?.reduce(
        (acc, a) => {
            acc[a.engagement_level] = (acc[a.engagement_level] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    ) ?? {};

    const dominantEngagement = Object.entries(engagementBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    const subspaceCount = subspaces?.length ?? 0;
    const hasSubspaces = subspaceCount > 0;

    if (spaceLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    if (!space) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <h2 className="text-2xl font-semibold">Space not found</h2>
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                    Back to dashboard
                </Button>
            </div>
        );
    }

    const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
        { id: 'overview', label: 'Overview', icon: Map },
        { id: 'artifacts', label: 'Artifacts', icon: FileText },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.push('/dashboard')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-3xl font-semibold tracking-tight"
                        >
                            {space.name}
                        </motion.h1>
                    </div>
                    {space.description && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-muted-foreground ml-10"
                        >
                            {space.description}
                        </motion.p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/spaces/${spaceId}/configuration`)}
                    >
                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                        Configure
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/spaces/${spaceId}/configuration`)}>
                                Configuration
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={handleDeleteSpace}
                                disabled={isDeleting}
                            >
                                Delete space
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            Total Artifacts
                        </CardDescription>
                        <CardTitle className="text-3xl">{space.artifact_count}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <Layers className="h-3 w-3" />
                            Subspaces
                        </CardDescription>
                        <CardTitle className="text-3xl">{subspaceCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <Activity className="h-3 w-3" />
                            Dominant Engagement
                        </CardDescription>
                        <CardTitle className="text-3xl capitalize">{dominantEngagement}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Last Capture
                        </CardDescription>
                        <CardTitle className="text-xl">
                            {lastArtifact
                                ? new Date(lastArtifact.created_at).toLocaleDateString()
                                : '—'}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-border">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors
                            border-b-2 -mb-px
                            ${activeTab === tab.id
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }
                        `}
                    >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                        {tab.id === 'artifacts' && artifacts && (
                            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                                {artifacts.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="flex gap-6">
                    {/* Main visualization */}
                    <div className="flex-1 space-y-6">
                        {subspacesLoading ? (
                            <Skeleton className="h-[360px] w-full" />
                        ) : hasSubspaces ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <Map className="h-4 w-4 text-primary" />
                                    Knowledge Map
                                </h2>
                                <SpaceBlobVisualization
                                    space={{
                                        id: space.id,
                                        name: space.name,
                                        subspaces: (subspaces || []).map((subspace) => ({
                                            id: String(subspace.id),
                                            name: subspace.name,
                                            evidence: Math.max(1, subspace.artifact_count ?? subspace.artifacts_count ?? 1),
                                            markers: [],
                                        })),
                                    }}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16"
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Map className="h-7 w-7" />
                                </div>
                                <h3 className="mt-4 text-lg font-medium">No subspaces to visualize</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Start capturing content with the Misir extension
                                </p>
                            </motion.div>
                        )}
                    </div>

                    {/* Sidebar */}
                    {artifacts && artifacts.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="w-64 flex-shrink-0 hidden lg:block"
                        >
                            <div className="sticky top-6">
                                <SpaceOverviewSidebar
                                    space={space}
                                    artifacts={artifacts}
                                />
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {activeTab === 'artifacts' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search artifacts..."
                                    className="w-72 pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {filteredArtifacts?.length ?? 0} artifact{(filteredArtifacts?.length ?? 0) !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {artifactsLoading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full" />
                            ))}
                        </div>
                    ) : filteredArtifacts && filteredArtifacts.length > 0 ? (
                        <div className="space-y-3">
                            {filteredArtifacts.map((artifact, index) => (
                                <motion.div
                                    key={artifact.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <Card
                                        className="group cursor-pointer transition-colors hover:border-primary/30 hover:bg-card/80"
                                        onClick={() => setSelectedArtifact(artifact)}
                                    >
                                        <CardHeader className="py-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 space-y-1">
                                                    <CardTitle className="text-sm font-medium">
                                                        {artifact.title || artifact.url}
                                                    </CardTitle>
                                                    <CardDescription className="flex items-center gap-2 text-xs">
                                                        <a
                                                            href={artifact.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 hover:text-foreground"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {artifact.domain}
                                                            <ExternalLink className="h-2.5 w-2.5" />
                                                        </a>
                                                        <span className="text-muted-foreground/40">·</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {new Date(artifact.created_at).toLocaleDateString()}
                                                        </span>
                                                        {artifact.word_count > 0 && (
                                                            <>
                                                                <span className="text-muted-foreground/40">·</span>
                                                                <span>{artifact.word_count.toLocaleString()} words</span>
                                                            </>
                                                        )}
                                                    </CardDescription>
                                                </div>
                                                <Badge
                                                    className={`text-[10px] ${engagementColors[artifact.engagement_level] || engagementColors.ambient}`}
                                                >
                                                    {artifact.engagement_level}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16"
                        >
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Plus className="h-7 w-7" />
                            </div>
                            <h3 className="mt-4 text-lg font-medium">
                                {searchQuery ? 'No matching artifacts' : 'No artifacts yet'}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {searchQuery
                                    ? 'Try adjusting your search query'
                                    : 'Start capturing content with the Misir extension to populate this space'}
                            </p>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Artifact Detail Modal */}
            <ArtifactDetailModal
                artifact={selectedArtifact}
                open={!!selectedArtifact}
                onClose={() => setSelectedArtifact(null)}
            />
        </div>
    );
}

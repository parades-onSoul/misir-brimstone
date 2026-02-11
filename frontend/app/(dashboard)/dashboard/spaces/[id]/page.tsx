'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Search, ExternalLink, Map as MapIcon, LayoutDashboard, Library as LibraryIcon, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSpace, useDeleteSpace, useSubspaces } from '@/lib/api/spaces';
import { useSpaceArtifacts } from '@/lib/api/artifacts';
import type { Artifact, Subspace } from '@/types/api';
import { ItemDetailModal } from '@/components/items/item-detail-modal';
import { SpaceBlobVisualization } from '@/components/space-blob-visualization'; 
import { KnowledgeMap } from '@/components/space/knowledge-map';
import { SimpleTimeline } from '@/components/space/detail-components';
import { DriftTimeline } from '@/components/space/drift-timeline';
import { SpaceHeader } from '@/components/space/space-header';
import { SpaceHealth } from '@/components/space/space-health';
import { SpaceAlerts } from '@/components/space/space-alerts';
import { SpaceInsights } from '@/components/space/space-insights';
import { CoverageAnalysis } from '@/components/space/coverage-analysis';
import { TopicAreas } from '@/components/space/topic-areas';
import { cn } from '@/lib/utils';
// We remove Shadcn imports to use custom Linear styled components
// import { Button } ...

const engagementColors: Record<string, string> = {
    latent: 'text-[#8A8F98]',
    discovered: 'text-[#5E6AD2]',
    engaged: 'text-emerald-500',
    saturated: 'text-amber-500',
};

type FitFilter = 'all' | 'latent' | 'discovered' | 'engaged' | 'saturated';
type DepthFilter = 'all' | 'skim' | 'partial' | 'deep';
type LibraryDateFilter = 'all' | '7d' | '30d' | '90d';
type LibrarySort = 'newest' | 'oldest' | 'reading-depth' | 'fit';
type TopicFilterValue = 'all' | string;

interface LibraryFilters {
    topic: TopicFilterValue;
    depth: DepthFilter;
    fit: FitFilter;
    dateRange: LibraryDateFilter;
}

const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
    topic: 'all',
    depth: 'all',
    fit: 'all',
    dateRange: 'all',
};

const LIBRARY_DATE_RANGE_TO_MS: Record<Exclude<LibraryDateFilter, 'all'>, number> = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
};

const DEPTH_LABELS: Record<Exclude<DepthFilter, 'all'>, string> = {
    skim: 'Skim',
    partial: 'Partial',
    deep: 'Deep',
};

const DEPTH_ACCENTS: Record<Exclude<DepthFilter, 'all'>, string> = {
    skim: 'bg-sky-400',
    partial: 'bg-amber-400',
    deep: 'bg-emerald-400',
};

const FIT_ORDER: Record<Exclude<FitFilter, 'all'>, number> = {
    latent: 0,
    discovered: 1,
    engaged: 2,
    saturated: 3,
};

const getReadingDepthBucket = (value: number | null | undefined): DepthFilter => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'skim';
    if (value >= 0.7) return 'deep';
    if (value >= 0.35) return 'partial';
    return 'skim';
};

const isWithinLibraryDateRange = (timestamp: string | null | undefined, range: LibraryDateFilter) => {
    if (range === 'all') return true;
    if (!timestamp) return false;
    const cutoff = LIBRARY_DATE_RANGE_TO_MS[range];
    const value = new Date(timestamp).getTime();
    if (Number.isNaN(value)) return false;
    return Date.now() - value <= cutoff;
};

const formatReadingMinutes = (minutes: number | null | undefined) => {
    if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) return '—';
    if (minutes < 1) return '<1m';
    return `${Math.round(minutes)}m`;
};

// TAB DEFINITIONS
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'library', label: 'Library', icon: LibraryIcon },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
];

export default function SpaceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    
    // URL Params
    const rawId = params.id as string;
    const spaceId = Number.isFinite(Number(rawId)) ? Number(rawId) : undefined;
    const activeTab = searchParams.get('tab') || 'overview';

    // State
    const [selectedItem, setSelectedItem] = useState<Artifact | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>({ ...DEFAULT_LIBRARY_FILTERS });
    const [sortBy, setSortBy] = useState<LibrarySort>('newest');

    // Queries
    const { data: space, isLoading: spaceLoading } = useSpace(spaceId as number, user?.id);
    const { data: subspaces } = useSubspaces(spaceId as number, user?.id);
    const { data: artifactsData, fetchNextPage, hasNextPage, isFetchingNextPage } = useSpaceArtifacts(spaceId, user?.id);

    const artifacts = useMemo(() => artifactsData?.pages.flatMap(page => page.items) ?? [], [artifactsData]);

    const subspaceLookup = useMemo(() => {
        const lookup = new Map<number, string>();
        subspaces?.forEach((sub) => lookup.set(sub.id, sub.name));
        return lookup;
    }, [subspaces]);

    const filteredArtifacts = useMemo(() => {
        if (!artifacts) return [] as Artifact[];
        const term = searchQuery.trim().toLowerCase();
        return artifacts.filter((artifact) => {
            const matchesSearch =
                term.length === 0 ||
                `${artifact.title ?? ''} ${artifact.url} ${artifact.domain}`.toLowerCase().includes(term);
            const topicMatch =
                libraryFilters.topic === 'all'
                    ? true
                    : String(artifact.subspace_id ?? '') === libraryFilters.topic;
            const depthBucket = getReadingDepthBucket(artifact.reading_depth);
            const depthMatch = libraryFilters.depth === 'all' || depthBucket === libraryFilters.depth;
            const fitMatch = libraryFilters.fit === 'all' || artifact.engagement_level === libraryFilters.fit;
            const dateSource = artifact.captured_at ?? artifact.created_at ?? artifact.updated_at ?? null;
            const dateMatch = isWithinLibraryDateRange(dateSource, libraryFilters.dateRange);
            return matchesSearch && topicMatch && depthMatch && fitMatch && dateMatch;
        });
    }, [artifacts, searchQuery, libraryFilters]);

    const sortedArtifacts = useMemo(() => {
        const list = [...filteredArtifacts];
        switch (sortBy) {
            case 'oldest':
                list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                break;
            case 'reading-depth':
                list.sort((a, b) => (b.reading_depth ?? 0) - (a.reading_depth ?? 0));
                break;
            case 'fit':
                list.sort(
                    (a, b) =>
                        (FIT_ORDER[b.engagement_level as keyof typeof FIT_ORDER] ?? -1) -
                        (FIT_ORDER[a.engagement_level as keyof typeof FIT_ORDER] ?? -1)
                );
                break;
            case 'newest':
            default:
                list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                break;
        }
        return list;
    }, [filteredArtifacts, sortBy]);

    const libraryStats = useMemo(() => {
        if (!filteredArtifacts.length) {
            return { total: 0, deep: 0, highFit: 0, avgMinutes: 0 };
        }
        const deep = filteredArtifacts.filter(
            (artifact) => getReadingDepthBucket(artifact.reading_depth) === 'deep'
        ).length;
        const highFit = filteredArtifacts.filter((artifact) =>
            ['engaged', 'saturated'].includes(artifact.engagement_level)
        ).length;
        const avgMinutes =
            filteredArtifacts.reduce((sum, artifact) => sum + (artifact.reading_time_min ?? 0), 0) /
            filteredArtifacts.length;
        return { total: filteredArtifacts.length, deep, highFit, avgMinutes };
    }, [filteredArtifacts]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (libraryFilters.topic !== 'all') count += 1;
        if (libraryFilters.depth !== 'all') count += 1;
        if (libraryFilters.fit !== 'all') count += 1;
        if (libraryFilters.dateRange !== 'all') count += 1;
        return count;
    }, [libraryFilters]);

    const activeFilterChips = useMemo(() => {
        const chips: { key: keyof LibraryFilters; label: string }[] = [];
        if (libraryFilters.topic !== 'all') {
            const label = subspaceLookup.get(Number(libraryFilters.topic)) ?? 'Unknown topic';
            chips.push({ key: 'topic', label: `Topic: ${label}` });
        }
        if (libraryFilters.depth !== 'all') {
            chips.push({ key: 'depth', label: `Depth: ${DEPTH_LABELS[libraryFilters.depth]}` });
        }
        if (libraryFilters.fit !== 'all') {
            chips.push({ key: 'fit', label: `Fit: ${libraryFilters.fit}` });
        }
        if (libraryFilters.dateRange !== 'all') {
            chips.push({ key: 'dateRange', label: `Captured: Last ${libraryFilters.dateRange}` });
        }
        return chips;
    }, [libraryFilters, subspaceLookup]);

    const { mutate: deleteSpace, isPending: isDeleting } = useDeleteSpace();

    const handleDeleteSpace = () => {
        if (!user || !spaceId) return;
        if (confirm('Are you sure you want to delete this space? This action cannot be undone.')) {
            deleteSpace(
                { spaceId, userId: user.id },
                {
                    onSuccess: () => router.push('/dashboard'),
                    onError: (error) => {
                        console.error('Failed to delete space:', error);
                        alert('Failed to delete space');
                    }
                }
            );
        }
    };

    // Tab Handler
    const handleTabChange = (tabId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tabId);
        router.push(`?${params.toString()}`);
    };

    const handleLibraryFilterChange = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => {
        setLibraryFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleResetLibraryFilters = () => {
        setLibraryFilters({ ...DEFAULT_LIBRARY_FILTERS });
    };

    const clearFilterChip = (key: keyof LibraryFilters) => {
        handleLibraryFilterChange(key, DEFAULT_LIBRARY_FILTERS[key]);
    };

    const toggleTopicFilter = (topicId: string) => {
        setLibraryFilters((prev) => ({
            ...prev,
            topic: prev.topic === topicId ? 'all' : topicId,
        }));
    };

    const focusTopicFromNode = (subspaceId: number | null | undefined) => {
        if (typeof subspaceId !== 'number') return;
        handleLibraryFilterChange('topic', String(subspaceId));
        handleTabChange('library');
    };

    const handleViewTopic = (subspaceId: number) => {
        handleLibraryFilterChange('topic', String(subspaceId));
        handleTabChange('library');
    };

    const notifyUnavailable = (message: string) => {
        alert(message);
    };

    const handleCreateTopic = () => notifyUnavailable('Manual topic creation is coming soon.');
    const handleRenameTopic = (topic: Subspace) => notifyUnavailable(`Renaming "${topic.name}" will be available after the backend update.`);
    const handleMergeTopic = (topic: Subspace) => notifyUnavailable(`Merge workflows for "${topic.name}" are coming soon.`);
    const handleDeleteTopic = (topic: Subspace) => notifyUnavailable(`Deleting "${topic.name}" requires backend support and is not available yet.`);

    if (!spaceId) return <div className="p-6">Space not found</div>;
    if (spaceLoading) return <div className="p-6">Loading...</div>;
    if (!space) return <div className="p-6">Space not found.</div>;

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0] animate-in fade-in duration-500">
            
            <SpaceHeader 
                space={space} 
                onDelete={handleDeleteSpace} 
                isDeleting={isDeleting} 
            />

            {/* TAB BAR */}
                 <div className="border-b border-white/5 bg-[#0B0C0E] sticky top-0 z-10">
                     <div className="max-w-300 mx-auto px-6 flex gap-6">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                                    isActive 
                                        ? "border-[#5E6AD2] text-[#EEEEF0]" 
                                        : "border-transparent text-[#5F646D] hover:text-[#EEEEF0]"
                                )}
                            >
                                <Icon className="size-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="max-w-300 mx-auto p-6 space-y-8">

                 {/* TAB: OVERVIEW */}
                 {activeTab === 'overview' && (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Panel: Health & Alerts */}
                            <div className="space-y-6">
                                {user && spaceId && <SpaceHealth spaceId={spaceId} userId={user.id} />}
                                {user && spaceId && <SpaceAlerts spaceId={spaceId} userId={user.id} />}
                            </div>

                            {/* Main Panel: Visualizations & Analysis */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Coverage Map (Blob Viz) */}
                                <section>
                                    <h2 className="text-lg font-medium text-[#EEEEF0] mb-4">Coverage Map</h2>
                                    <div className="h-[400px] bg-[#141517] border border-white/5 rounded-lg overflow-hidden relative">
                                        {subspaces && (
                                            <SpaceBlobVisualization 
                                                space={{
                                                    id: space.id,
                                                    name: space.name,
                                                    subspaces: subspaces.map((sub) => ({
                                                        id: String(sub.id),
                                                        name: sub.name,
                                                        evidence: Math.max(1, sub.artifact_count || 5), 
                                                        markers: sub.markers || []
                                                    }))
                                                }}
                                                onSubspaceClick={(sub) => {
                                                    toggleTopicFilter(sub.id);
                                                    handleTabChange('library');
                                                }}
                                            />
                                        )}
                                    </div>
                                </section>

                                <TopicAreas
                                    subspaces={subspaces}
                                    artifacts={artifacts}
                                    onCreateTopic={handleCreateTopic}
                                    onViewTopic={handleViewTopic}
                                    onRenameTopic={handleRenameTopic}
                                    onMergeTopic={handleMergeTopic}
                                    onDeleteTopic={handleDeleteTopic}
                                />
                            </div>
                        </div>

                        <section>
                            <CoverageAnalysis subspaces={subspaces} spaceId={spaceId} userId={user?.id} />
                        </section>

                        {user && spaceId && (
                            <section>
                                <DriftTimeline spaceId={spaceId} userId={user.id} onSelectSubspace={handleViewTopic} />
                            </section>
                        )}

                         {/* Recent Activity */}
                         <section>
                            {artifacts && <SimpleTimeline artifacts={artifacts.slice(0, 5)} />}
                         </section>
                    </>
                 )}

                 {/* TAB: MAP */}
                 {activeTab === 'map' && (
                    <div className="h-[calc(100vh-200px)]">
                        {user && spaceId && (
                            <KnowledgeMap 
                                spaceId={spaceId} 
                                userId={user.id} 
                                className="h-full w-full"
                                onNodeClick={(node) => {
                                     // Filter library by this node
                                     focusTopicFromNode(node.subspace_id);
                                }}
                            />
                        )}
                    </div>
                 )}

                 {/* TAB: LIBRARY (All Artifacts) */}
                 {activeTab === 'library' && (
                    <section className="space-y-6">
                        <div className="space-y-4 rounded-2xl border border-white/5 bg-[#141517] p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                                    <input
                                        type="text"
                                        placeholder="Search title, domain, or URL"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-11 w-full rounded-lg border border-white/10 bg-[#0B0C0E] pl-10 pr-3 text-[13px] text-white placeholder:text-white/40 focus:outline-none focus:border-[#5E6AD2]"
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-white/60">
                                    <span className="uppercase tracking-wide text-white/40">Sort</span>
                                    <Select value={sortBy} onValueChange={(value) => setSortBy(value as LibrarySort)}>
                                        <SelectTrigger className="h-11 w-44 border-white/10 bg-[#0B0C0E] text-white">
                                            <SelectValue placeholder="Newest" />
                                        </SelectTrigger>
                                        <SelectContent className="border-white/10 bg-[#0B0C0E] text-white">
                                            <SelectItem value="newest">Newest first</SelectItem>
                                            <SelectItem value="oldest">Oldest first</SelectItem>
                                            <SelectItem value="reading-depth">Deepest reads</SelectItem>
                                            <SelectItem value="fit">Highest fit</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <Select
                                    value={libraryFilters.topic}
                                    onValueChange={(value) => handleLibraryFilterChange('topic', value as TopicFilterValue)}
                                >
                                    <SelectTrigger className="h-11 border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectValue placeholder="Topic" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectItem value="all">All topics</SelectItem>
                                        {subspaces?.map((subspace) => (
                                            <SelectItem key={subspace.id} value={String(subspace.id)}>
                                                {subspace.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={libraryFilters.depth}
                                    onValueChange={(value) => handleLibraryFilterChange('depth', value as DepthFilter)}
                                >
                                    <SelectTrigger className="h-11 border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectValue placeholder="Reading depth" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectItem value="all">Any depth</SelectItem>
                                        <SelectItem value="skim">Skim</SelectItem>
                                        <SelectItem value="partial">Partial</SelectItem>
                                        <SelectItem value="deep">Deep</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={libraryFilters.fit}
                                    onValueChange={(value) => handleLibraryFilterChange('fit', value as FitFilter)}
                                >
                                    <SelectTrigger className="h-11 border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectValue placeholder="Fit" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectItem value="all">All fits</SelectItem>
                                        <SelectItem value="latent">Latent</SelectItem>
                                        <SelectItem value="discovered">Discovered</SelectItem>
                                        <SelectItem value="engaged">Engaged</SelectItem>
                                        <SelectItem value="saturated">Saturated</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={libraryFilters.dateRange}
                                    onValueChange={(value) => handleLibraryFilterChange('dateRange', value as LibraryDateFilter)}
                                >
                                    <SelectTrigger className="h-11 border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectValue placeholder="Captured" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-[#0B0C0E] text-white">
                                        <SelectItem value="all">All time</SelectItem>
                                        <SelectItem value="7d">Last 7 days</SelectItem>
                                        <SelectItem value="30d">Last 30 days</SelectItem>
                                        <SelectItem value="90d">Last 90 days</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                                {activeFilterChips.length === 0 && (
                                    <span className="text-white/40">No filters applied.</span>
                                )}
                                {activeFilterChips.map((chip) => (
                                    <button
                                        key={chip.key}
                                        onClick={() => clearFilterChip(chip.key)}
                                        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80 transition-colors hover:bg-white/10"
                                    >
                                        {chip.label}
                                        <span className="text-white/50">×</span>
                                    </button>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto h-8 px-3 text-[12px] text-white/70 hover:text-white"
                                    onClick={handleResetLibraryFilters}
                                    disabled={!activeFilterCount}
                                >
                                    Reset filters
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-2xl border border-white/5 bg-[#0B0C0E] p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Matching items</p>
                                <p className="text-2xl font-semibold text-white">{libraryStats.total}</p>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0B0C0E] p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Deep reads</p>
                                <p className="text-2xl font-semibold text-white">{libraryStats.deep}</p>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0B0C0E] p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">High fit</p>
                                <p className="text-2xl font-semibold text-white">{libraryStats.highFit}</p>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0B0C0E] p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Avg. reading time</p>
                                <p className="text-2xl font-semibold text-white">
                                    {libraryStats.avgMinutes > 0 ? `${libraryStats.avgMinutes.toFixed(1)}m` : '—'}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#101114]">
                            <div className="hidden border-b border-white/5 bg-white/5 px-5 py-3 text-[11px] uppercase tracking-wide text-white/50 md:grid md:grid-cols-[2.4fr,1.2fr,1.1fr,0.9fr,1fr]">
                                <span>Item</span>
                                <span>Topic</span>
                                <span>Reading depth</span>
                                <span>Fit</span>
                                <span className="text-right md:text-left">Captured</span>
                            </div>
                            <div className="divide-y divide-white/5">
                                {sortedArtifacts.length > 0 ? (
                                    sortedArtifacts.map((artifact) => {
                                        const depthBucket = getReadingDepthBucket(artifact.reading_depth);
                                        const depthLabel = depthBucket === 'all' ? 'Any' : DEPTH_LABELS[depthBucket as Exclude<DepthFilter, 'all'>];
                                        const depthAccent = depthBucket === 'all' ? DEPTH_ACCENTS.skim : DEPTH_ACCENTS[depthBucket as Exclude<DepthFilter, 'all'>];
                                        const readingPercent = Math.min(100, Math.max(0, Math.round((artifact.reading_depth ?? 0) * 100)));
                                        const topicLabel = artifact.subspace_id ? subspaceLookup.get(artifact.subspace_id) ?? 'Unlabeled topic' : 'Unlabeled topic';
                                        const capturedLabel = new Date(artifact.captured_at ?? artifact.created_at).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        });
                                        return (
                                            <div
                                                key={artifact.id}
                                                onClick={() => setSelectedItem(artifact)}
                                                className="cursor-pointer transition-colors hover:bg-white/5"
                                            >
                                                <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[2.4fr,1.2fr,1.1fr,0.9fr,1fr] md:items-center">
                                                    <div className="min-w-0 space-y-1">
                                                        <p className="truncate text-[13px] font-semibold text-white">
                                                            {artifact.title || artifact.url}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                                                            <ExternalLink className="h-3 w-3" />
                                                            <span className="truncate">{artifact.domain}</span>
                                                            <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-wide text-white/70">
                                                                {artifact.content_source}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] text-white">{topicLabel}</p>
                                                        <p className="text-[11px] text-white/50">Topic</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] uppercase text-white/50">Reading depth</p>
                                                        <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                                                            <div
                                                                className={cn('h-full rounded-full', depthAccent)}
                                                                style={{ width: `${readingPercent}%` }}
                                                            />
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-white/70">{depthLabel}</p>
                                                    </div>
                                                    <div>
                                                        <p className={cn('text-[13px] font-semibold capitalize', engagementColors[artifact.engagement_level] || 'text-white')}>
                                                            {artifact.engagement_level}
                                                        </p>
                                                        <p className="text-[11px] text-white/50">{formatReadingMinutes(artifact.reading_time_min)}</p>
                                                    </div>
                                                    <div className="text-right md:text-left">
                                                        <p className="text-[13px] text-white">{capturedLabel}</p>
                                                        <p className="text-[11px] text-white/50">Captured</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="px-6 py-16 text-center text-sm text-white/60">
                                        No items match these filters.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                 )}
                 
                 {activeTab === 'insights' && user && spaceId && (
                     <SpaceInsights spaceId={spaceId} userId={user.id} />
                 )}
                 {activeTab === 'insights' && (!user || !spaceId) && (
                     <div className="text-center py-20 text-muted-foreground">
                         <p>Sign in to view space insights.</p>
                     </div>
                 )}

            </div>

            {/* Modals */}
             {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    open={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}



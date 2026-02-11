'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useSpace, useSpaceAlerts, useSpaceArtifacts, useSubspaces } from '@/lib/api/spaces';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, AlertCircle, TrendingUp, BookOpen, Map, Sparkles, Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSpaceStatus, getFocusDots, formatRelativeTime, getReadingDepth } from '@/lib/formatters';
import { getSpaceColor } from '@/lib/colors';
import type { SpaceAlert, AlertAction, SpaceArtifactResponse } from '@/types/api';

export default function SpaceDetailPage() {
    const params = useParams();
    const spaceId = parseInt(params.id as string);
    const { user } = useAuth();
    
    const { data: space, isLoading: spaceLoading } = useSpace(spaceId, user?.id);
    const { data: alertsData } = useSpaceAlerts(spaceId, user?.id);
    const { data: subspaces = [] } = useSubspaces(spaceId, user?.id);
    
    const [activeTab, setActiveTab] = useState('overview');
    
    // Library tab state (Job 23: Search, Filter, Sort)
    const [libraryPage, setLibraryPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTopic, setFilterTopic] = useState<string>('all');
    const [filterFit, setFilterFit] = useState<string>('all');
    const [filterDepth, setFilterDepth] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('date-desc');
    
    // Fetch artifacts for Overview (first 10)
    const { data: overviewArtifactsData } = useSpaceArtifacts(spaceId, user?.id, 1, 10);
    
    // Fetch artifacts for Library (paginated, 20 per page)
    const { data: libraryArtifactsData, isLoading: libraryLoading } = useSpaceArtifacts(
        spaceId, 
        user?.id, 
        libraryPage, 
        20
    );
    
    const alerts = alertsData?.alerts || [];
    const overviewArtifacts = overviewArtifactsData?.artifacts || [];
    const libraryArtifacts = libraryArtifactsData?.artifacts || [];
    const totalLibraryCount = libraryArtifactsData?.count || 0;
    const totalPages = Math.ceil(totalLibraryCount / 20);
    
    // Client-side filtering and sorting for Library tab
    const filteredLibraryArtifacts = libraryArtifacts
        .filter((artifact: SpaceArtifactResponse) => {
            // Search filter
            if (searchQuery && artifact.title) {
                if (!artifact.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return false;
                }
            }
            
            // Topic filter
            if (filterTopic !== 'all') {
                if (filterTopic === 'none' && artifact.subspace_id !== null) return false;
                if (filterTopic !== 'none' && artifact.subspace_id !== parseInt(filterTopic)) return false;
            }
            
            // Fit filter
            if (filterFit !== 'all' && artifact.margin !== null) {
                if (filterFit === 'high' && artifact.margin < 0.5) return false;
                if (filterFit === 'medium' && (artifact.margin < 0.3 || artifact.margin >= 0.5)) return false;
                if (filterFit === 'low' && artifact.margin >= 0.3) return false;
            }
            
            // Reading depth filter
            if (filterDepth !== 'all') {
                if (artifact.engagement_level !== filterDepth) return false;
            }
            
            return true;
        })
        .sort((a: SpaceArtifactResponse, b: SpaceArtifactResponse) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'date-asc':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'fit-desc':
                    return (b.margin || 0) - (a.margin || 0);
                case 'fit-asc':
                    return (a.margin || 0) - (b.margin || 0);
                case 'time-desc':
                    return b.dwell_time_ms - a.dwell_time_ms;
                case 'time-asc':
                    return a.dwell_time_ms - b.dwell_time_ms;
                default:
                    return 0;
            }
        });
    
    // Calculate metrics (SpaceResponse doesn't include these, using defaults)
    const avgConfidence = 0.65; // TODO: Calculate from artifacts once available
    const focusDots = getFocusDots(avgConfidence);
    const status = getSpaceStatus({ 
        confidence: avgConfidence,
        drift: undefined,
        avg_margin: undefined 
    });
    const spaceColor = getSpaceColor(0); // TODO: Use actual index from spaces list
    
    if (spaceLoading) {
        return (
            <div className="min-h-screen w-full bg-[#0B0C0E] flex items-center justify-center">
                <div className="text-[#8A8F98]">Loading space...</div>
            </div>
        );
    }
    
    if (!space) {
        return (
            <div className="min-h-screen w-full bg-[#0B0C0E] flex items-center justify-center">
                <div className="text-[#8A8F98]">Space not found</div>
            </div>
        );
    }
    
    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            {/* Space Overview Header */}
            <div className="border-b border-white/5 bg-linear-to-b from-white/2 to-transparent">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                            <h2 className="text-2xl font-semibold text-[#EEEEF0] mb-2">
                                {space.name}
                            </h2>
                            {space.description && (
                                <p className="text-[15px] text-[#8A8F98] max-w-2xl">
                                    {space.description}
                                </p>
                            )}
                        </div>
                        
                        {/* Quick Metrics */}
                        <div className="flex gap-6 text-[13px]">
                            <div className="text-center">
                                <div className="text-2xl font-semibold text-[#EEEEF0] mb-1">
                                    {space.artifact_count || 0}
                                </div>
                                <div className="text-[#5F646D]">Items</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-semibold text-[#EEEEF0] mb-1">
                                    {subspaces.length}
                                </div>
                                <div className="text-[#5F646D]">Topics</div>
                            </div>
                            <div className="text-center">
                                <div className="flex gap-1 mb-1 justify-center">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div 
                                            key={i}
                                            className={cn(
                                                "size-1.5 rounded-full",
                                                i < focusDots ? "bg-emerald-500" : "bg-white/10"
                                            )}
                                        />
                                    ))}
                                </div>
                                <div className="text-[#5F646D]">Focus</div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/3 border border-white/5 text-[13px] text-[#8A8F98]">
                        {status}
                    </div>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                    <TabsList className="bg-transparent border-b border-white/5 rounded-none h-auto p-0 w-full justify-start">
                        <TabsTrigger 
                            value="overview" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5E6AD2] data-[state=active]:bg-transparent data-[state=active]:text-[#EEEEF0] text-[#8A8F98] px-4 py-3"
                        >
                            <Sparkles className="size-4 mr-2" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger 
                            value="map" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5E6AD2] data-[state=active]:bg-transparent data-[state=active]:text-[#EEEEF0] text-[#8A8F98] px-4 py-3"
                        >
                            <Map className="size-4 mr-2" />
                            Map
                        </TabsTrigger>
                        <TabsTrigger 
                            value="library" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5E6AD2] data-[state=active]:bg-transparent data-[state=active]:text-[#EEEEF0] text-[#8A8F98] px-4 py-3"
                        >
                            <BookOpen className="size-4 mr-2" />
                            Library
                        </TabsTrigger>
                        <TabsTrigger 
                            value="insights" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#5E6AD2] data-[state=active]:bg-transparent data-[state=active]:text-[#EEEEF0] text-[#8A8F98] px-4 py-3"
                        >
                            <TrendingUp className="size-4 mr-2" />
                            Insights
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* Overview Tab */}
                    <TabsContent value="overview" className="mt-6 space-y-6">
                        {/* How You're Doing Panel */}
                        <section className="bg-[#141517] border border-white/5 rounded-lg p-6">
                            <h3 className="text-[15px] font-medium text-[#EEEEF0] mb-4">
                                How You&apos;re Doing
                            </h3>
                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <div className="text-[13px] text-[#5F646D] mb-2">Focus Level</div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <div 
                                                    key={i}
                                                    className={cn(
                                                        "h-2 w-3 rounded-full",
                                                        i < focusDots ? "bg-emerald-500" : "bg-white/10"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[14px] text-[#EEEEF0] font-medium">
                                            {Math.round(avgConfidence * 100)}%
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[13px] text-[#5F646D] mb-2">Items Saved</div>
                                    <div className="text-[20px] font-semibold text-[#EEEEF0]">
                                        {space.artifact_count || 0}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[13px] text-[#5F646D] mb-2">Topics Explored</div>
                                    <div className="text-[20px] font-semibold text-[#EEEEF0]">
                                        {subspaces.length}
                                    </div>
                                </div>
                            </div>
                        </section>
                        
                        {/* Smart Alerts */}
                        {alerts.length > 0 && (
                            <section>
                                <h3 className="text-[15px] font-medium text-[#EEEEF0] mb-3">
                                    Alerts
                                </h3>
                                <div className="space-y-3">
                                    {alerts.map((alert: SpaceAlert, idx: number) => (
                                        <div 
                                            key={idx}
                                            className={cn(
                                                "flex items-start gap-3 p-4 rounded-lg border",
                                                alert.severity === 'danger' && "bg-red-500/10 border-red-500/20",
                                                alert.severity === 'warning' && "bg-amber-500/10 border-amber-500/20",
                                                alert.severity === 'info' && "bg-blue-500/10 border-blue-500/20"
                                            )}
                                        >
                                            <AlertCircle className={cn(
                                                "size-5 shrink-0 mt-0.5",
                                                alert.severity === 'danger' && "text-red-500",
                                                alert.severity === 'warning' && "text-amber-500",
                                                alert.severity === 'info' && "text-blue-500"
                                            )} />
                                            <div className="flex-1">
                                                <p className="text-[14px] text-[#EEEEF0] mb-2">
                                                    {alert.message}
                                                </p>
                                                {alert.suggested_actions && alert.suggested_actions.length > 0 && (
                                                    <div className="flex gap-2">
                                                        {alert.suggested_actions.map((action: AlertAction, actionIdx: number) => (
                                                            <button
                                                                key={actionIdx}
                                                                className="text-[12px] text-[#5E6AD2] hover:text-[#7C4DFF] font-medium transition-colors"
                                                            >
                                                                {action.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                        
                        {/* Topic Areas */}
                        {subspaces.length > 0 && (
                            <section>
                                <h3 className="text-[15px] font-medium text-[#EEEEF0] mb-3">
                                    Topics
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {subspaces.map((subspace) => {
                                        const subspaceFocus = getFocusDots(subspace.confidence || 0);
                                        return (
                                            <div 
                                                key={subspace.id}
                                                className="bg-[#141517] border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors"
                                            >
                                                <h4 className="text-[14px] font-medium text-[#EEEEF0] mb-2">
                                                    {subspace.name}
                                                </h4>
                                                {subspace.description && (
                                                    <p className="text-[13px] text-[#8A8F98] mb-3 line-clamp-2">
                                                        {subspace.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center justify-between text-[12px]">
                                                    <span className="text-[#5F646D]">
                                                        {subspace.artifact_count || 0} items
                                                    </span>
                                                    <div className="flex gap-0.5">
                                                        {Array.from({ length: 8 }).map((_, i) => (
                                                            <div 
                                                                key={i}
                                                                className={cn(
                                                                    "size-1 rounded-full",
                                                                    i < subspaceFocus ? "bg-emerald-500" : "bg-white/10"
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                        
                        {/* Empty State */}
                        {overviewArtifacts.length === 0 && (
                            <div className="text-center py-12 text-[#5F646D]">
                                <BookOpen className="size-12 mx-auto mb-4 opacity-50" />
                                <p className="text-[15px] mb-2">No items yet</p>
                                <p className="text-[13px]">
                                    Start saving content from your browser extension
                                </p>
                            </div>
                        )}
                    </TabsContent>
                    
                    {/* Map Tab */}
                    <TabsContent value="map" className="mt-6">
                        <div className="text-center py-12 text-[#5F646D]">
                            <Map className="size-12 mx-auto mb-4 opacity-50" />
                            <p className="text-[15px]">Knowledge map coming soon</p>
                        </div>
                    </TabsContent>
                    
                    {/* Library Tab (Jobs 22-23) */}
                    <TabsContent value="library" className="mt-6 space-y-6">
                        {/* Search & Filters Bar */}
                        <div className="flex flex-col gap-4 bg-[#141517] border border-white/5 rounded-lg p-4">
                            {/* Search */}
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5F646D]" />
                                    <Input
                                        placeholder="Search items..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 bg-[#0B0C0E] border-white/5 text-[14px]"
                                    />
                                </div>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger className="w-45 bg-[#0B0C0E] border-white/5 text-[13px]">
                                        <SelectValue placeholder="Sort by" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="date-desc">Newest first</SelectItem>
                                        <SelectItem value="date-asc">Oldest first</SelectItem>
                                        <SelectItem value="fit-desc">Best fit</SelectItem>
                                        <SelectItem value="fit-asc">Worst fit</SelectItem>
                                        <SelectItem value="time-desc">Most time</SelectItem>
                                        <SelectItem value="time-asc">Least time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {/* Filters */}
                            <div className="flex items-center gap-3">
                                <span className="text-[13px] text-[#5F646D] min-w-fit">Filter by:</span>
                                
                                <Select value={filterTopic} onValueChange={setFilterTopic}>
                                    <SelectTrigger className="w-40 bg-[#0B0C0E] border-white/5 text-[13px]">
                                        <SelectValue placeholder="Topic" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All topics</SelectItem>
                                        <SelectItem value="none">No topic</SelectItem>
                                        {subspaces.map((subspace) => (
                                            <SelectItem key={subspace.id} value={subspace.id.toString()}>
                                                {subspace.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                
                                <Select value={filterFit} onValueChange={setFilterFit}>
                                    <SelectTrigger className="w-40 bg-[#0B0C0E] border-white/5 text-[13px]">
                                        <SelectValue placeholder="Fit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All fits</SelectItem>
                                        <SelectItem value="high">Clear match</SelectItem>
                                        <SelectItem value="medium">Somewhat related</SelectItem>
                                        <SelectItem value="low">Doesn&apos;t fit well</SelectItem>
                                    </SelectContent>
                                </Select>
                                
                                <Select value={filterDepth} onValueChange={setFilterDepth}>
                                    <SelectTrigger className="w-40 bg-[#0B0C0E] border-white/5 text-[13px]">
                                        <SelectValue placeholder="Reading Depth" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All depths</SelectItem>
                                        <SelectItem value="saturated">Deep dive</SelectItem>
                                        <SelectItem value="engaged">Studied</SelectItem>
                                        <SelectItem value="discovered">Read</SelectItem>
                                        <SelectItem value="latent">Skimmed</SelectItem>
                                    </SelectContent>
                                </Select>
                                
                                {(searchQuery || filterTopic !== 'all' || filterFit !== 'all' || filterDepth !== 'all') && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilterTopic('all');
                                            setFilterFit('all');
                                            setFilterDepth('all');
                                        }}
                                        className="text-[12px] text-[#8A8F98] hover:text-[#EEEEF0]"
                                    >
                                        Clear filters
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        {/* Table */}
                        {libraryLoading ? (
                            <div className="text-center py-12 text-[#5F646D]">
                                Loading items...
                            </div>
                        ) : filteredLibraryArtifacts.length === 0 ? (
                            <div className="text-center py-12 text-[#5F646D] border border-dashed border-white/10 rounded-lg">
                                {libraryArtifacts.length === 0 ? (
                                    <>
                                        <BookOpen className="size-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-[15px] mb-2">No items yet</p>
                                        <p className="text-[13px]">
                                            Start saving content from your browser extension
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Search className="size-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-[15px] mb-2">No items match your filters</p>
                                        <p className="text-[13px]">
                                            Try adjusting your search or filters
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="bg-[#141517] border border-white/5 rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                <TableHead className="text-[#8A8F98] font-medium w-[35%]">Title</TableHead>
                                                <TableHead className="text-[#8A8F98] font-medium w-[15%]">Topic</TableHead>
                                                <TableHead className="text-[#8A8F98] font-medium w-[12%]">Fit</TableHead>
                                                <TableHead className="text-[#8A8F98] font-medium w-[13%]">Reading Depth</TableHead>
                                                <TableHead className="text-[#8A8F98] font-medium w-[12%]">Time Spent</TableHead>
                                                <TableHead className="text-[#8A8F98] font-medium w-[13%]">Saved</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredLibraryArtifacts.map((artifact: SpaceArtifactResponse) => {
                                                const topic = subspaces.find(s => s.id === artifact.subspace_id);
                                                const fitColor = artifact.margin !== null 
                                                    ? (artifact.margin >= 0.5 ? 'text-emerald-500' : artifact.margin >= 0.3 ? 'text-amber-500' : 'text-red-500')
                                                    : 'text-[#5F646D]';
                                                const depth = getReadingDepth(artifact.engagement_level);
                                                const timeSpent = Math.round(artifact.dwell_time_ms / 1000); // seconds
                                                const timeDisplay = timeSpent >= 60 
                                                    ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` 
                                                    : `${timeSpent}s`;
                                                
                                                return (
                                                    <TableRow key={artifact.id} className="border-white/5 hover:bg-white/2">
                                                        <TableCell>
                                                            <a
                                                                href={artifact.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 group"
                                                            >
                                                                <span className="text-[14px] text-[#EEEEF0] group-hover:text-white transition-colors truncate">
                                                                    {artifact.title || 'Untitled'}
                                                                </span>
                                                                <ExternalLink className="size-3 text-[#5F646D] group-hover:text-[#8A8F98] shrink-0 transition-colors" />
                                                            </a>
                                                        </TableCell>
                                                        <TableCell>
                                                            {topic ? (
                                                                <span className="text-[13px] text-[#8A8F98]">
                                                                    {topic.name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[13px] text-[#5F646D] italic">
                                                                    None
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex gap-0.5">
                                                                    {Array.from({ length: 5 }).map((_, i) => {
                                                                        const threshold = (i + 1) * 0.2;
                                                                        const filled = artifact.margin !== null && artifact.margin >= threshold;
                                                                        return (
                                                                            <div
                                                                                key={i}
                                                                                className={cn(
                                                                                    "h-2 w-1.5 rounded-full",
                                                                                    filled ? fitColor.replace('text-', 'bg-') : "bg-white/10"
                                                                                )}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                                <span className={cn("text-[12px] font-medium", fitColor)}>
                                                                    {artifact.margin !== null ? Math.round(artifact.margin * 100) : '—'}%
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-[13px] text-[#EEEEF0]">{depth}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-[13px] text-[#8A8F98]">{timeDisplay}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-[13px] text-[#8A8F98]">
                                                                {formatRelativeTime(artifact.created_at)}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                
                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between">
                                        <div className="text-[13px] text-[#8A8F98]">
                                            Showing {((libraryPage - 1) * 20) + 1} to {Math.min(libraryPage * 20, totalLibraryCount)} of {totalLibraryCount} items
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setLibraryPage(p => Math.max(1, p - 1))}
                                                disabled={libraryPage === 1}
                                                className="text-[13px]"
                                            >
                                                <ChevronLeft className="size-4 mr-1" />
                                                Previous
                                            </Button>
                                            <span className="text-[13px] text-[#8A8F98] px-3">
                                                Page {libraryPage} of {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setLibraryPage(p => Math.min(totalPages, p + 1))}
                                                disabled={libraryPage === totalPages}
                                                className="text-[13px]"
                                            >
                                                Next
                                                <ChevronRight className="size-4 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>
                    
                    {/* Insights Tab */}
                    <TabsContent value="insights" className="mt-6">
                        <div className="text-center py-12 text-[#5F646D]">
                            <TrendingUp className="size-12 mx-auto mb-4 opacity-50" />
                            <p className="text-[15px]">Insights coming soon</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

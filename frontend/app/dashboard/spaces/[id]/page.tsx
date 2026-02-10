'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Plus, Search, MoreHorizontal, ExternalLink, Clock,
    Settings, FileText, Layers, Activity, Calendar, Trash2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSpace, useDeleteSpace, useSubspaces } from '@/lib/api/spaces';
import { useArtifacts } from '@/lib/api/artifacts';
import type { Artifact } from '@/types/api';
import { ArtifactDetailModal } from '@/components/artifacts/artifact-detail-modal';
import { SpaceBlobVisualization } from '@/components/space-blob-visualization'; // Assuming this can fit, if not we'll wrap it
import { cn } from '@/lib/utils';
// We remove Shadcn imports to use custom Linear styled components
// import { Button } ...

const engagementColors: Record<string, string> = {
    latent: 'text-[#8A8F98]',
    discovered: 'text-[#5E6AD2]',
    engaged: 'text-emerald-500',
    saturated: 'text-amber-500',
};

type Tab = 'overview' | 'artifacts';

export default function SpaceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const rawId = params.id as string;
    const spaceId = Number.isFinite(Number(rawId)) ? Number(rawId) : undefined;

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: space, isLoading: spaceLoading } = useSpace(spaceId as number, user?.id);
    const { data: subspaces, isLoading: subspacesLoading } = useSubspaces(spaceId as number, user?.id);
    const { data: artifacts, isLoading: artifactsLoading } = useArtifacts(spaceId as number, user?.id);

    const filteredArtifacts = artifacts?.filter((a) =>
        (a.title?.toLowerCase() || a.url.toLowerCase()).includes(searchQuery.toLowerCase())
    );

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

    if (!spaceId) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#0B0C0E] text-[#EEEEF0]">
                <h2 className="text-xl font-medium mb-4">Space not found</h2>
                <button 
                    onClick={() => router.push('/dashboard/spaces')}
                    className="h-8 px-4 bg-[#white/[0.05] hover:bg-white/[0.1] rounded text-[13px] font-medium"
                >
                    Back to Spaces
                </button>
            </div>
        );
    }

    if (spaceLoading) {
        return <div className="min-h-full w-full bg-[#0B0C0E] p-6 text-[#EEEEF0]">Loading...</div>; // Placeholder for now
    }

    if (!space) {
        return <div className="min-h-full w-full bg-[#0B0C0E] p-6 text-[#EEEEF0]">Space not found.</div>;
    }

    // DEBUG: Check markers
    if (subspaces && subspaces.length > 0) {
        console.log("DEBUG: First subspace:", {
            name: subspaces[0].name,
            markers: subspaces[0].markers,
            raw: subspaces[0]
        });
    }

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

    const dominantEngagement = Object.entries(engagementBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
    const subspaceCount = subspaces?.length ?? 0;

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            
            {/* 1. Header (Sticky) */}
            <header className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B0C0E]/80 backdrop-blur-md sticky top-0 z-10">
                <nav className="flex items-center gap-2 text-[13px]">
                    <Layers className="size-4 text-[#8A8F98]" strokeWidth={1.5} />
                    <span className="text-[#8A8F98]">Spaces</span>
                    <span className="text-[#5F646D]">/</span>
                    <span className="text-[#EEEEF0] font-medium truncate max-w-[200px]">{space.name}</span>
                </nav>

                <div className="flex items-center gap-2">
                    <button 
                         onClick={handleDeleteSpace}
                        className="size-7 flex items-center justify-center text-[#8A8F98] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Delete Space"
                    >
                        <Trash2 className="size-3.5" strokeWidth={1.5} />
                    </button>
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <button className="text-[13px] text-[#8A8F98] hover:text-[#EEEEF0] font-medium transition-colors">
                        Settings
                    </button>
                </div>
            </header>

            {/* 2. Content */}
            <div className="p-6 space-y-6">
                
                {/* Title & Desc */}
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#EEEEF0] mb-2">{space.name}</h1>
                    <p className="text-[14px] text-[#8A8F98] leading-relaxed max-w-3xl">
                        {space.description || "No description provided."}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 border-b border-white/5 text-[13px] font-medium">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={cn(
                            "pb-3 border-b-2 transition-colors",
                            activeTab === 'overview' 
                                ? "text-[#5E6AD2] border-[#5E6AD2]" 
                                : "text-[#8A8F98] border-transparent hover:text-[#EEEEF0]"
                        )}
                    >
                        Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('artifacts')}
                        className={cn(
                            "pb-3 border-b-2 transition-colors",
                            activeTab === 'artifacts' 
                                ? "text-[#5E6AD2] border-[#5E6AD2]" 
                                : "text-[#8A8F98] border-transparent hover:text-[#EEEEF0]"
                        )}
                    >
                        Artifacts <span className="ml-1 text-[#5F646D]">{artifacts?.length || 0}</span>
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Stats Grid */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatBox 
                                label="Total Artifacts" 
                                value={space.artifact_count} 
                                icon={FileText} 
                            />
                            <StatBox 
                                label="Sub-spaces" 
                                value={subspaceCount} 
                                icon={Layers} 
                            />
                            <StatBox 
                                label="Dominant State" 
                                value={dominantEngagement} 
                                icon={Activity} 
                                capitalize
                            />
                            <StatBox 
                                label="Last Activity" 
                                value={lastArtifact ? new Date(lastArtifact.captured_at || lastArtifact.created_at).toLocaleDateString() : '—'} 
                                icon={Calendar} 
                            />
                        </div>

                        {/* Visualization Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 h-[400px] bg-[#141517] border border-white/5 rounded-lg overflow-hidden relative">
                                <div className="absolute top-4 left-4 z-10">
                                    <h3 className="text-[13px] font-medium text-[#EEEEF0]">Knowledge Graph</h3>
                                    <p className="text-[11px] text-[#8A8F98]">Semantic relationships</p>
                                </div>
                                <div className="absolute inset-0">
                                     {/* This might need custom width/height/class passed down */}
                                     {/* Wrapping in div to contain it */}
                                     <div className="size-full opacity-80 mix-blend-screen bg-black">
                                         <SpaceBlobVisualization 
                                            space={{
                                                id: space.id,
                                                name: space.name,
                                                subspaces: (subspaces || []).map((sub) => ({
                                                    id: String(sub.id),
                                                    name: sub.name,
                                                    evidence: Math.max(1, sub.artifact_count || 5),
                                                    markers: sub.markers || []
                                                }))
                                            }}
                                         />
                                     </div>
                                </div>
                            </div>
                            
                            {/* Subspaces List */}
                            <div className="bg-[#141517] border border-white/5 rounded-lg p-5">
                                <h3 className="text-[13px] font-medium text-[#EEEEF0] mb-4 flex items-center gap-2">
                                    <Layers className="size-3.5 text-[#5F646D]" />
                                    Subspaces {subspaceCount > 0 && `(${subspaceCount})`}
                                </h3>
                                
                                <div className="space-y-2">
                                    {subspaces && subspaces.length > 0 ? (
                                        subspaces.map((sub) => (
                                            <div key={sub.id} className="flex items-center justify-between p-2 rounded bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group">
                                                <span className="text-[13px] text-[#8A8F98] group-hover:text-[#EEEEF0]">{sub.name}</span>
                                                <ExternalLink className="size-3 text-[#5F646D] opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-[13px] text-[#5F646D] italic">No subspaces found</div>
                                    )}
                                </div>
                                
                                <button className="mt-4 w-full h-8 flex items-center justify-center gap-2 border border-dashed border-white/10 rounded text-[11px] text-[#8A8F98] hover:text-[#EEEEF0] hover:border-white/20 transition-all">
                                    <Plus className="size-3" />
                                    Create Subspace
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'artifacts' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                    >
                         {/* Search Bar */}
                        <div className="relative mb-4 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#5F646D]" />
                            <input
                                type="text"
                                placeholder="Search artifacts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 bg-[#141517] border border-white/5 rounded pl-9 pr-3 text-[13px] text-[#EEEEF0] placeholder:text-[#5F646D] focus:outline-none focus:border-white/10 transition-colors"
                            />
                        </div>

                        {/* Artifact List */}
                        <div className="border border-white/5 rounded-lg bg-[#141517] overflow-hidden">
                            <div className="grid grid-cols-[1fr,120px,120px] px-4 py-2 border-b border-white/5 bg-white/[0.02] text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">
                                <div>Title / Source</div>
                                <div>Status</div>
                                <div className="text-right">Date</div>
                            </div>
                            <div className="divide-y divide-white/[0.02]">
                                {filteredArtifacts && filteredArtifacts.length > 0 ? (
                                    filteredArtifacts.map((artifact) => (
                                        <div 
                                            key={artifact.id}
                                            onClick={() => setSelectedArtifact(artifact)}
                                            className="grid grid-cols-[1fr,120px,120px] px-4 py-3 hover:bg-white/[0.02] cursor-pointer group transition-colors items-center"
                                        >
                                            <div className="min-w-0 pr-4">
                                                <div className="text-[13px] text-[#EEEEF0] truncate font-medium mb-0.5">{artifact.title || 'Untitled'}</div>
                                                <div className="text-[11px] text-[#5F646D] truncate flex items-center gap-1.5">
                                                    <ExternalLink className="size-2.5" />
                                                    {artifact.url}
                                                </div>
                                            </div>
                                            <div>
                                                <span className={cn("text-[11px] font-medium capitalize", engagementColors[artifact.engagement_level] || "text-[#5F646D]")}>
                                                    {artifact.engagement_level}
                                                </span>
                                            </div>
                                            <div className="text-right text-[11px] text-[#5F646D] font-mono">
                                                {new Date(artifact.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-12 text-center text-[13px] text-[#5F646D]">
                                        No artifacts found matching your search.
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

            </div>

            {/* Modals */}
             {selectedArtifact && (
                <ArtifactDetailModal
                    artifact={selectedArtifact}
                    open={!!selectedArtifact}
                    onClose={() => setSelectedArtifact(null)}
                />
            )}
        </div>
    );
}

// --- Helper Components ---

const StatBox = ({ label, value, icon: Icon, capitalize }: any) => (
    <div className="bg-[#141517] border border-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#8A8F98] uppercase tracking-wide">{label}</span>
            <Icon className="size-3.5 text-[#5F646D]" strokeWidth={1.5} />
        </div>
        <div className={cn("text-xl font-semibold text-[#EEEEF0] tracking-tight", capitalize && "capitalize")}>
            {value}
        </div>
    </div>
);


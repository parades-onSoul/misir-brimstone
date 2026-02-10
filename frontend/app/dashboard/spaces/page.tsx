'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { useUIStore } from '@/lib/stores/ui'; 
import { Layers, Plus, Search, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { ActivitySparkline } from '@/components/report/report-visuals';
import type { SpaceResponse } from '@/types/api';

export default function SpacesPage() {
    const { user } = useAuth();
    const { data: spacesData, isLoading } = useSpaces(user?.id);
    const { openCreateSpaceModal } = useUIStore();
    const spaces = spacesData?.spaces ?? [];

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            
            {/* 1. Header (Sticky) */}
            <header className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B0C0E]/80 backdrop-blur-md sticky top-0 z-10">
                <nav className="flex items-center gap-2 text-[13px]">
                    <Layers className="size-4 text-[#8A8F98]" strokeWidth={1.5} />
                    <span className="text-[#8A8F98]">Dashboard</span>
                    <span className="text-[#5F646D]">/</span>
                    <span className="text-[#EEEEF0] font-medium">Spaces</span>
                </nav>

                <div className="flex items-center gap-2">
                    <button 
                         onClick={openCreateSpaceModal}
                        className="h-7 px-3 flex items-center gap-1.5 bg-[#5E6AD2] hover:bg-[#4e5ac0] text-white text-[11px] font-medium rounded transition-colors shadow-[0_0_10px_rgba(94,106,210,0.2)]"
                    >
                        <Plus className="size-3" strokeWidth={2} />
                        New Space
                    </button>
                </div>
            </header>

            {/* 2. Content Canvas */}
            <div className="p-6 space-y-6">
                
                {/* Search / Filter Toolbar */}
                <div className="flex items-center gap-4 max-w-md">
                     <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#5F646D] group-focus-within:text-[#EEEEF0] transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Filter spaces..." 
                            className="w-full h-9 bg-[#141517] border border-white/5 rounded pl-9 pr-3 text-[13px] text-[#EEEEF0] placeholder:text-[#5F646D] focus:outline-none focus:border-white/10 transition-colors"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-40 rounded-lg bg-[#141517] animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : spaces.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {spaces.map((space: SpaceResponse, i: number) => (
                            <SpaceCard key={space.id} space={space} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-lg">
                        <div className="size-12 rounded-full bg-[#141517] flex items-center justify-center mb-4">
                            <Layers className="size-6 text-[#5F646D]" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-[14px] font-medium text-[#EEEEF0] mb-1">No spaces yet</h3>
                        <p className="text-[13px] text-[#8A8F98] mb-6 max-w-sm text-center">
                            Spaces organize your knowledge into topics. Create your first space to get started.
                        </p>
                        <button 
                            onClick={openCreateSpaceModal}
                            className="h-8 px-4 bg-[#EEEEF0] text-[#0B0C0E] hover:bg-white text-[13px] font-medium rounded transition-colors"
                        >
                            Create Space
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Sub-Components ---

const SpaceCard = ({ space, index }: { space: SpaceResponse; index: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
        >
            <Link 
                href={`/dashboard/spaces/${space.id}`}
                className="block h-full group relative"
            >
                <div className="h-full bg-[#141517] border border-white/5 rounded-lg p-5 hover:border-white/10 transition-colors flex flex-col">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="size-10 rounded bg-[#5E6AD2]/10 flex items-center justify-center text-[#5E6AD2] font-semibold text-lg border border-[#5E6AD2]/20">
                            {space.name[0].toUpperCase()}
                        </div>
                        <button className="text-[#5F646D] hover:text-[#EEEEF0] transition-colors p-1 -mr-2 -mt-2">
                            <MoreHorizontal className="size-4" />
                        </button>
                    </div>

                    {/* Title & Desc */}
                    <div className="mb-6 flex-1">
                        <h3 className="text-[14px] font-medium text-[#EEEEF0] mb-1 truncate group-hover:text-[#5E6AD2] transition-colors">
                            {space.name}
                        </h3>
                        <p className="text-[13px] text-[#8A8F98] line-clamp-2 leading-relaxed">
                            {space.description || "No description provided."}
                        </p>
                    </div>

                    {/* Footer / Stats */}
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px] text-[#5F646D]">
                            <span className="flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-emerald-500/50" />
                                {space.artifact_count} items
                            </span>
                        </div>
                         {/* Mini Sparkline for visual flair - Use simpler stable data to avoid hydration error */}
                         <div className="w-16 h-8 opacity-30 grayscale group-hover:grayscale-0 transition-all">
                             <ActivitySparkline 
                                data={[3, 5, 2, 8, 4]} 
                                height={32}
                            />
                         </div>
                    </div>

                </div>
            </Link>
        </motion.div>
    );
}

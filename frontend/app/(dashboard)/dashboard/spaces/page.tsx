'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { useUIStore } from '@/lib/stores/ui'; 
import { Layers, Plus, Search, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardHeader } from '@/components/dashboard/header';
import Link from 'next/link';
import { ActivitySparkline } from '@/components/report/report-visuals';
import type { SpaceResponse } from '@/types/api';

export default function SpacesPage() {
    const { user } = useAuth();
    const { data: spacesData, isLoading } = useSpaces(user?.id);
    const { openCreateSpaceModal } = useUIStore();
    const spaces = spacesData?.spaces ?? [];

    return (
        <div className="min-h-full w-full bg-background text-foreground">
            <DashboardHeader
                icon={Layers}
                breadcrumbs={[
                    { label: 'Dashboard' },
                    { label: 'Spaces', active: true }
                ]}
            >
                <Button 
                         onClick={openCreateSpaceModal}
                         className="h-7 px-3 gap-1.5 text-[11px] font-medium"
                         size="sm"
                    >
                        <Plus className="size-3" strokeWidth={2} />
                        New Space
                </Button>
            </DashboardHeader>

            {/* 2. Content Canvas */}
            <div className="p-6 space-y-6">
                
                {/* Search / Filter Toolbar */}
                <div className="flex items-center gap-4 max-w-md">
                     <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 group-focus-within:text-foreground transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Filter spaces..." 
                            className="w-full h-9 bg-muted/30 border border-border rounded pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border/80 transition-colors"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-40 rounded-lg bg-card animate-pulse border border-border" />
                        ))}
                    </div>
                ) : spaces.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {spaces.map((space: SpaceResponse, i: number) => (
                            <SpaceCard key={space.id} space={space} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg">
                        <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                            <Layers className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-[14px] font-medium text-foreground mb-1">No spaces yet</h3>
                        <p className="text-[13px] text-muted-foreground mb-6 max-w-sm text-center">
                            Spaces organize your knowledge into topics. Create your first space to get started.
                        </p>
                        <Button 
                            onClick={openCreateSpaceModal}
                            variant="secondary"
                            className="h-8 px-4 text-[13px]"
                        >
                            Create Space
                        </Button>
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
                <div className="h-full bg-card border border-border rounded-lg p-5 hover:border-foreground/20 transition-colors flex flex-col">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="size-10 rounded bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg border border-primary/20">
                            {space.name[0].toUpperCase()}
                        </div>
                        <button className="text-muted-foreground/60 hover:text-foreground transition-colors p-1 -mr-2 -mt-2">
                            <MoreHorizontal className="size-4" />
                        </button>
                    </div>

                    {/* Title & Desc */}
                    <div className="mb-6 flex-1">
                        <h3 className="text-[14px] font-medium text-foreground mb-1 truncate group-hover:text-primary transition-colors">
                            {space.name}
                        </h3>
                        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {space.description || "No description provided."}
                        </p>
                    </div>

                    {/* Footer / Stats */}
                    <div className="pt-4 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
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

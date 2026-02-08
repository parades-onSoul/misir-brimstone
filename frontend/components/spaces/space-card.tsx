'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Folder, ArrowRight, FileText } from 'lucide-react';
import type { Space } from '@/types/api';

interface SpaceCardProps {
    space: Space;
    index?: number;
}

// Folder-style colors based on index for variety
const folderColors = [
    { bg: 'from-blue-500/20 to-blue-600/10', icon: 'text-blue-400', tab: 'bg-blue-500/30' },
    { bg: 'from-purple-500/20 to-purple-600/10', icon: 'text-purple-400', tab: 'bg-purple-500/30' },
    { bg: 'from-emerald-500/20 to-emerald-600/10', icon: 'text-emerald-400', tab: 'bg-emerald-500/30' },
    { bg: 'from-amber-500/20 to-amber-600/10', icon: 'text-amber-400', tab: 'bg-amber-500/30' },
    { bg: 'from-pink-500/20 to-pink-600/10', icon: 'text-pink-400', tab: 'bg-pink-500/30' },
    { bg: 'from-cyan-500/20 to-cyan-600/10', icon: 'text-cyan-400', tab: 'bg-cyan-500/30' },
];

export function SpaceCard({ space, index = 0 }: SpaceCardProps) {
    const router = useRouter();
    const colorScheme = folderColors[index % folderColors.length];

    return (
        <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.04, type: 'spring', stiffness: 200 }}
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
        >
            <div
                className="group cursor-pointer relative"
                onClick={() => router.push(`/dashboard/spaces/${space.id}`)}
            >
                {/* Folder Tab */}
                <div className={`absolute -top-1.5 left-2.5 w-12 h-2.5 ${colorScheme.tab} rounded-t-md`} />

                {/* Main Folder Body */}
                <div className={`
                    relative overflow-hidden rounded-lg border border-white/10 
                    bg-gradient-to-br ${colorScheme.bg}
                    backdrop-blur-sm
                    transition-all duration-200
                    hover:border-white/20 hover:shadow-md hover:shadow-black/20
                `}>
                    <div className="p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                            <div className={`
                                flex h-8 w-8 items-center justify-center rounded-lg 
                                bg-white/5 border border-white/10
                                ${colorScheme.icon}
                                transition-transform duration-200 group-hover:scale-105
                            `}>
                                <Folder className="h-4 w-4" />
                            </div>
                            <ArrowRight className="h-3 w-3 text-white/40 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-medium text-white mb-0.5 line-clamp-1">
                            {space.name}
                        </h3>

                        {/* Stats */}
                        <div className="flex items-center gap-1 text-[10px] text-white/40">
                            <FileText className="h-2.5 w-2.5" />
                            <span>{space.artifact_count} items</span>
                        </div>
                    </div>

                    {/* Corner fold */}
                    <div className="absolute top-0 right-0">
                        <div className="w-0 h-0 border-t-[12px] border-t-neutral-900/80 border-l-[12px] border-l-transparent" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

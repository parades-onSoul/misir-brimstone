'use client';

import Link from 'next/link';
import { ArrowRight, Layers, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/formatters';

interface SpaceCardProps {
    id: number;
    name: string;
    description: string | null;
    status: string;
    lastActive?: string | null;
    focusDots: number; // 0-8
    artifactCount: number;
    className?: string;
}

export function SpaceCard({ 
    id, 
    name, 
    description, 
    status, 
    lastActive, 
    focusDots, 
    artifactCount,
    className 
}: SpaceCardProps) {
    return (
        <Link 
            href={`/dashboard/spaces/${id}`}
            className={cn(
                "group relative block p-5 rounded-xl border border-[#27272A] bg-[#18181B]/50 hover:bg-[#18181B] hover:border-[#3F3F46] transition-all duration-200",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="text-base font-medium text-[#FAFAFA] group-hover:text-white transition-colors">
                        {name}
                    </h3>
                    <p className="text-xs text-[#A1A1AA] line-clamp-1 mt-1">
                        {description || 'No description provided'}
                    </p>
                </div>
                
                {/* Focus Dots Visualization */}
                <div className="flex gap-[3px] mt-1.5" title={`Focus Score: ${focusDots}/8`}>
                    {[...Array(8)].map((_, i) => (
                        <div 
                            key={i}
                            className={cn(
                                "w-1 h-1 rounded-full transition-colors duration-300",
                                i < focusDots 
                                    ? "bg-emerald-500/80 shadow-[0_0_4px_rgba(16,185,129,0.4)]" 
                                    : "bg-[#27272A]"
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Status & Metrics */}
            <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#27272A]/50 border border-[#27272A]">
                        <span className="text-[10px] uppercase font-medium tracking-wider text-[#A1A1AA]">
                            {status}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#71717A]">
                    <div className="flex items-center gap-1">
                        <Layers className="size-3" />
                        <span>{artifactCount}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Last Activity">
                        <Clock className="size-3" />
                        <span>{formatRelativeTime(lastActive)}</span>
                    </div>
                </div>
            </div>
            
            {/* Hover Action */}
            <div className="absolute top-5 right-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                <ArrowRight className="size-4 text-[#A1A1AA]" />
            </div>
        </Link>
    );
}

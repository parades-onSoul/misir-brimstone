'use client';

import { Layers, Trash2, Clock, Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Space } from '@/types/api';
import { formatRelativeTime } from '@/lib/formatters';

interface SpaceHeaderProps {
    space: Space;
    onDelete: () => void;
    isDeleting: boolean;
}

export function SpaceHeader({ space, onDelete, isDeleting }: SpaceHeaderProps) {
    return (
        <div className="border-b border-white/5 bg-[#0B0C0E]/80 backdrop-blur-md sticky top-0 z-20">
            <div className="max-w-[1200px] mx-auto px-6 h-auto py-4">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-[11px] text-[#8A8F98] mb-3">
                    <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
                        <ArrowLeft className="size-3" /> Back to Dashboard
                    </Link>
                    <span>/</span>
                    <span>Spaces</span>
                    <span>/</span>
                    <span className="text-[#EEEEF0]">{space.name}</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Title & Description */}
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold text-[#EEEEF0] mb-2">{space.name}</h1>
                        <p className="text-[14px] text-[#8A8F98] leading-relaxed max-w-2xl">
                            {space.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-4 text-[12px] text-[#8A8F98]">
                            <div className="flex items-center gap-1.5" title="Items">
                                <Layers className="size-3.5" />
                                <span>{space.artifact_count} items</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Last Updated">
                                <Clock className="size-3.5" />
                                <span>{formatRelativeTime(space.updated_at)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                disabled={true}
                                className="px-3 py-1.5 rounded-md bg-[#141517] border border-white/5 text-[12px] font-medium text-[#8A8F98] hover:text-white hover:bg-[#27272A] transition-colors cursor-not-allowed opacity-50"
                                title="Settings coming soon"
                            >
                                <Settings className="size-3.5 inline mr-1.5" />
                                Settings
                            </button>
                            
                            <button
                                onClick={onDelete}
                                disabled={isDeleting}
                                className="px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-[12px] font-medium text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                            >
                                {isDeleting ? (
                                    'Deleting...'
                                ) : (
                                    <>
                                        <Trash2 className="size-3.5" />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

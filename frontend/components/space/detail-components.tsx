'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import type { Subspace, Artifact } from '@/types/api';

interface DecisionReadinessProps {
    subspaces: Subspace[];
    artifacts: Artifact[];
}

export function DecisionReadiness({ subspaces, artifacts }: DecisionReadinessProps) {
    // 1. Analyze Coverage
    const coverage = useMemo(() => {
        const covered: Subspace[] = [];
        const gaps: Subspace[] = [];
        
        subspaces.forEach(sub => {
            // Heuristic: If > 3 items, it's covered. Else gap.
            const count = artifacts.filter(a => a.subspace_id === sub.id).length;
            if (count > 3) covered.push(sub);
            else gaps.push(sub);
        });

        // Heuristic: Suggest reads from "Discovered" (not yet Engaged) items
        const suggestions = artifacts
            .filter(a => a.engagement_level === 'discovered' || a.engagement_level === 'latent')
            .slice(0, 3);

        return { covered, gaps, suggestions };
    }, [subspaces, artifacts]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* 1. Well Covered */}
            <div className="bg-[#141517] border border-border/50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4 text-emerald-500">
                    <CheckCircle2 className="size-4" />
                    <h3 className="text-sm font-medium">Well Covered</h3>
                </div>
                {coverage.covered.length > 0 ? (
                    <ul className="space-y-2">
                        {coverage.covered.slice(0, 3).map(sub => (
                            <li key={sub.id} className="text-[13px] text-muted-foreground flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-emerald-500/50" />
                                {sub.name}
                            </li>
                        ))}
                         {coverage.covered.length > 3 && (
                            <li className="text-[11px] text-muted-foreground/60 pl-3.5">
                                +{coverage.covered.length - 3} more
                            </li>
                        )}
                    </ul>
                ) : (
                    <p className="text-[13px] text-muted-foreground italic">No areas fully covered yet.</p>
                )}
            </div>

            {/* 2. Gaps Detected */}
            <div className="bg-[#141517] border border-border/50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4 text-amber-500">
                    <AlertTriangle className="size-4" />
                    <h3 className="text-sm font-medium">Gaps Detected</h3>
                </div>
                {coverage.gaps.length > 0 ? (
                    <ul className="space-y-2">
                         {coverage.gaps.slice(0, 3).map(sub => (
                            <li key={sub.id} className="text-[13px] text-muted-foreground flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-amber-500/50" />
                                {sub.name}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[13px] text-muted-foreground italic">No significant gaps.</p>
                )}
            </div>

            {/* 3. Suggested Reads */}
            <div className="bg-[#141517] border border-border/50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4 text-[#5E6AD2]">
                    <Lightbulb className="size-4" />
                    <h3 className="text-sm font-medium">Suggested Reads</h3>
                </div>
                 {coverage.suggestions.length > 0 ? (
                    <ul className="space-y-3">
                         {coverage.suggestions.map(art => (
                            <li key={art.id} className="text-[13px] group cursor-pointer">
                                <a href={art.url} target="_blank" rel="noopener noreferrer" className="block text-[#EEEEF0] hover:text-[#5E6AD2] transition-colors truncate font-medium">
                                    {art.title || art.url}
                                </a>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    {art.reading_time_min ? `${art.reading_time_min}m read` : 'Quick read'}
                                    <span className="text-muted-foreground/30">•</span>
                                    {art.domain}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-[13px] text-muted-foreground italic">No suggestions right now.</p>
                )}
            </div>
        </div>
    );
}

// Minimal Collapsible Timeline
interface SimpleTimelineProps {
    artifacts: Artifact[];
}

export function SimpleTimeline({ artifacts }: SimpleTimelineProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Sort chronological (newest first for feed?)
    // Prompt said: "Title, Date, Domain".
    
    if (!artifacts || artifacts.length === 0) return null;

    return (
        <div className="border border-border/50 rounded-lg bg-[#141517] overflow-hidden mb-8">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-10 flex items-center justify-between px-4 bg-white/2 hover:bg-white/4 transition-colors"
            >
                <span className="text-[13px] font-medium text-[#EEEEF0] flex items-center gap-2">
                   <Calendar className="size-3.5 text-muted-foreground" />
                   Timeline Feed
                </span>
                {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            </button>
            
            {isOpen && (
                <div className="max-h-75 overflow-y-auto p-2 space-y-1">
                    {artifacts.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-white/2 transition-colors gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-[#EEEEF0] truncate">{a.title}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[11px] text-muted-foreground">{a.domain}</span>
                                <span className="text-[11px] text-muted-foreground/60 w-16 text-right">
                                    {new Date(a.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

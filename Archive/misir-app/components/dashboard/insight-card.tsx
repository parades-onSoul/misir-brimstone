'use client';

import { Insight } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Check, FileText } from 'lucide-react';
import {
    StateDistributionBar,
    ActivitySparkline,
    MovementArrow,
    StateDot
} from '@/components/report/report-visuals';

interface InsightCardProps {
    insight: Insight;
    onSwipe: (direction: 'left' | 'right' | 'up') => void;
    active: boolean;
    className?: string;
}

export function InsightCard({ insight, onSwipe, active, className }: InsightCardProps) {
    const controls = useAnimation();

    // Drag constraints
    const handleDragEnd = async (_: unknown, info: PanInfo) => {
        const offset = info.offset;
        const velocity = info.velocity;

        if (offset.x > 100 || velocity.x > 500) {
            await controls.start({ x: 500, opacity: 0 });
            onSwipe('right'); // Keep
        } else if (offset.x < -100 || velocity.x < -500) {
            await controls.start({ x: -500, opacity: 0 });
            onSwipe('left'); // Dismiss
        } else if (offset.y < -100 || velocity.y < -500) {
            await controls.start({ y: -500, opacity: 0 });
            onSwipe('up'); // Crystallize
        } else {
            controls.start({ x: 0, y: 0 });
        }
    };

    // Visualizing the delta data
    const renderVisuals = () => {
        const d = insight.delta;

        // Safety check for metadata structure
        const massDelta = (d.metadata as any)?.massDelta;
        const direction = (d.metadata as any)?.direction;
        const wordCount = (d.metadata as any)?.wordCount;

        return (
            <div className="mt-4 space-y-4">
                {/* Drift / Imbalance Visuals */}
                {massDelta && (
                    <div className="p-3 bg-muted/20 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Attention Shift</p>
                        {/* We can reproduce a mini-chart here if needed, or just text summary */}
                        <div className="flex justify-between items-center text-sm">
                            <span>Latent</span>
                            <span className={cn(massDelta[0] > 0 ? "text-green-500" : "text-red-500")}>
                                {massDelta[0] > 0 ? '+' : ''}{Math.round(massDelta[0])}
                            </span>
                        </div>
                    </div>
                )}

                {/* Consumption Trap Visuals */}
                {insight.type === 'consumption_trap' && (
                    <div className="flex items-center gap-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <div className="text-2xl">📚</div>
                        <div>
                            <div className="text-xl font-bold text-red-500">{Math.round((wordCount || 0) / 1000)}k</div>
                            <div className="text-xs text-red-500/80">words read</div>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="text-xl font-bold text-muted-foreground">0</div>
                            <div className="text-xs text-muted-foreground">notes</div>
                        </div>
                    </div>
                )}

                {/* Generic Subspace Info */}
                {d.subspaceId && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Topic:</span>
                        <span className="font-medium text-foreground">{d.subspaceName}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <motion.div
            drag={active}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            animate={controls}
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            className={cn(
                "absolute w-full max-w-sm bg-card border border-border rounded-xl shadow-xl p-6 cursor-grab active:cursor-grabbing",
                // Stack effect could be handled by parent, but basic valid CSS here
                className
            )}
            style={{ touchAction: 'none' }}
        >
            {/* Header Badge */}
            <div className={cn(
                "inline-block px-2 py-1 rounded-full text-xs font-medium mb-3",
                insight.severity === 'high' ? "bg-red-500/10 text-red-500" :
                    insight.severity === 'medium' ? "bg-amber-500/10 text-amber-500" :
                        "bg-blue-500/10 text-blue-500"
            )}>
                {insight.type.replace('_', ' ').toUpperCase()}
            </div>

            <h3 className="text-lg font-semibold leading-tight mb-2">
                {insight.headline}
            </h3>

            <p className="text-sm text-muted-foreground leading-relaxed">
                {insight.explanation}
            </p>

            {renderVisuals()}

            {/* Interaction Hints */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-8 text-xs font-medium text-muted-foreground/50 opacity-0 active:opacity-100 transition-opacity">
                <div className="flex items-center gap-1"><X size={14} /> Dismiss</div>
                <div className="flex items-center gap-1"><FileText size={14} /> Crystallize</div>
                <div className="flex items-center gap-1"><Check size={14} /> Keep</div>
            </div>
        </motion.div>
    );
}

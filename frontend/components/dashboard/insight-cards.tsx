'use client';

import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Lightbulb, X, Check, ChevronUp } from 'lucide-react';
import type { Insight, InsightSeverity } from '@/types/api';

interface InsightCardProps {
    insight: Insight;
    onDismiss?: (id: number) => void;
    onAct?: (id: number) => void;
    onKeep?: (id: number) => void;
}

const SEVERITY_STYLES: Record<InsightSeverity, { border: string; icon: string; bg: string }> = {
    low: { border: 'border-green-500/20', icon: 'text-green-400', bg: 'bg-green-500/5' },
    medium: { border: 'border-yellow-500/20', icon: 'text-yellow-400', bg: 'bg-yellow-500/5' },
    high: { border: 'border-orange-500/20', icon: 'text-orange-400', bg: 'bg-orange-500/5' },
    critical: { border: 'border-red-500/20', icon: 'text-red-400', bg: 'bg-red-500/5' },
};

export function InsightCard({ insight, onDismiss, onAct, onKeep }: InsightCardProps) {
    const [isGone, setIsGone] = useState(false);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
    const keepOpacity = useTransform(x, [0, 100], [0, 1]);
    const dismissOpacity = useTransform(x, [-100, 0], [1, 0]);
    const actOpacity = useTransform(y, [-100, 0], [1, 0]);

    const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.low;

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 100;

        if (info.offset.x > threshold) {
            // Swipe right → Keep
            setIsGone(true);
            onKeep?.(insight.id);
        } else if (info.offset.x < -threshold) {
            // Swipe left → Dismiss
            setIsGone(true);
            onDismiss?.(insight.id);
        } else if (info.offset.y < -threshold) {
            // Swipe up → Act
            setIsGone(true);
            onAct?.(insight.id);
        }
    };

    if (isGone) return null;

    return (
        <motion.div
            drag
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            style={{ x, y, rotate, opacity }}
            whileTap={{ cursor: 'grabbing' }}
            className={`
                relative cursor-grab rounded-lg border ${style.border} ${style.bg}
                p-4 select-none touch-none
            `}
        >
            {/* Swipe indicators */}
            <motion.div
                style={{ opacity: keepOpacity }}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            >
                <Check className="h-5 w-5 text-green-400" />
            </motion.div>
            <motion.div
                style={{ opacity: dismissOpacity }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            >
                <X className="h-5 w-5 text-red-400" />
            </motion.div>
            <motion.div
                style={{ opacity: actOpacity }}
                className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2"
            >
                <ChevronUp className="h-5 w-5 text-primary" />
            </motion.div>

            {/* Content */}
            <div className="flex gap-3">
                <div className={`mt-0.5 ${style.icon}`}>
                    <Lightbulb className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{insight.headline}</div>
                    {insight.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {insight.description}
                        </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="capitalize">{insight.severity}</span>
                        <span>·</span>
                        <span>{new Date(insight.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Swipe hint */}
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/50">
                <span>← dismiss</span>
                <span>↑ act</span>
                <span>keep →</span>
            </div>
        </motion.div>
    );
}

// ============ Insight Stack ============

interface InsightStackProps {
    insights: Insight[];
    onDismiss?: (id: number) => void;
    onAct?: (id: number) => void;
    onKeep?: (id: number) => void;
}

export function InsightStack({ insights, onDismiss, onAct, onKeep }: InsightStackProps) {
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());

    const visible = insights.filter((i) => !dismissed.has(i.id));

    const handleDismiss = (id: number) => {
        setDismissed((prev) => new Set([...prev, id]));
        onDismiss?.(id);
    };

    const handleAct = (id: number) => {
        setDismissed((prev) => new Set([...prev, id]));
        onAct?.(id);
    };

    const handleKeep = (id: number) => {
        setDismissed((prev) => new Set([...prev, id]));
        onKeep?.(id);
    };

    if (visible.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10">
                <Lightbulb className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">All caught up!</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {visible.slice(0, 5).map((insight) => (
                <InsightCard
                    key={insight.id}
                    insight={insight}
                    onDismiss={handleDismiss}
                    onAct={handleAct}
                    onKeep={handleKeep}
                />
            ))}
            {visible.length > 5 && (
                <p className="text-center text-xs text-muted-foreground">
                    +{visible.length - 5} more insights
                </p>
            )}
        </div>
    );
}

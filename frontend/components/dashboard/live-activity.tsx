'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';

interface LiveEvent {
    id: string;
    type: 'capture' | 'insight' | 'drift';
    title: string;
    detail: string;
    timestamp: Date;
}

interface LiveActivityProps {
    events?: LiveEvent[];
    maxItems?: number;
}

/**
 * Live activity feed showing recent captures and system events.
 * In production, this would subscribe to Supabase Realtime.
 */
export function LiveActivity({ events: externalEvents, maxItems = 5 }: LiveActivityProps) {
    const displayEvents = externalEvents ?? [];

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span>Live Activity</span>
            </div>

            <AnimatePresence mode="popLayout">
                {displayEvents.length > 0 ? (
                    displayEvents.slice(0, maxItems).map((event) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-start gap-2 rounded-md bg-muted/20 px-3 py-2">
                                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${event.type === 'capture' ? 'bg-primary' :
                                        event.type === 'insight' ? 'bg-yellow-400' :
                                            'bg-orange-400'
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">{event.title}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                        {event.detail}
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                                    {formatTimeAgo(event.timestamp)}
                                </span>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-4 text-xs text-muted-foreground"
                    >
                        No recent activity. Capture content with the extension to see live events.
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

// ============ Live Pulse ============

interface PulseMessage {
    id: string;
    text: string;
    type: 'concentration' | 'dormancy' | 'velocity' | 'milestone';
}

interface LivePulseProps {
    totalArtifacts: number;
    spacesCount: number;
    className?: string;
}

export function LivePulse({ totalArtifacts, spacesCount, className = '' }: LivePulseProps) {
    const [messages, setMessages] = useState<PulseMessage[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Generate periodic insight-like messages
        const generate = () => {
            const templates: PulseMessage[] = [];

            if (totalArtifacts > 0) {
                templates.push({
                    id: `${Date.now()}-1`,
                    text: `Tracking ${totalArtifacts} knowledge artifacts across ${spacesCount} space${spacesCount !== 1 ? 's' : ''}.`,
                    type: 'milestone',
                });
            }

            if (totalArtifacts > 10) {
                templates.push({
                    id: `${Date.now()}-2`,
                    text: 'High concentration detected — you\'re building depth in your current focus area.',
                    type: 'concentration',
                });
            }

            if (spacesCount > 3) {
                templates.push({
                    id: `${Date.now()}-3`,
                    text: `${spacesCount} active spaces suggest broad exploration. Consider deepening a specific area.`,
                    type: 'velocity',
                });
            }

            if (templates.length > 0) {
                const selected = templates[Math.floor(Math.random() * templates.length)];
                setMessages((prev) => [selected, ...prev.slice(0, 2)]);
            }
        };

        generate();
        intervalRef.current = setInterval(generate, 30000); // Every 30s

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [totalArtifacts, spacesCount]);

    const typeIcon: Record<string, string> = {
        concentration: '🔬',
        dormancy: '💤',
        velocity: '⚡',
        milestone: '🎯',
    };

    return (
        <div className={className}>
            <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-start gap-2 text-xs text-muted-foreground py-1"
                    >
                        <span>{typeIcon[msg.type] || '💡'}</span>
                        <span>{msg.text}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

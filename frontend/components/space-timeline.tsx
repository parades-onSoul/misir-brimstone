'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { TimelineResponse } from '@/types/api';
import { ExternalLink } from 'lucide-react';

interface SpaceTimelineProps {
    data: TimelineResponse;
}

export function SpaceTimeline({ data }: SpaceTimelineProps) {
    // Process data for chart: Cumulative count over time
    const chartData = useMemo(() => {
        if (!data?.artifacts) return [];
        
        // Sort by date ascending (oldest first)
        const sorted = [...data.artifacts].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        return sorted.map((artifact, index) => ({
            date: new Date(artifact.created_at).toLocaleDateString(),
            timestamp: new Date(artifact.created_at).getTime(),
            count: index + 1,
            title: artifact.title
        }));
    }, [data]);

    if (!data?.artifacts?.length) {
        return <div className="text-muted-foreground p-6">No timeline data available.</div>;
    }

    return (
        <div className="space-y-8">
            {/* Growth Chart */}
            <div className="h-64 w-full bg-muted/10 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-medium mb-4 text-muted-foreground">Growth over time</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#5E6AD2" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis 
                            dataKey="date" 
                            stroke="#5F646D" 
                            fontSize={11} 
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis 
                            stroke="#5F646D" 
                            fontSize={11} 
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#141517', borderColor: '#2C2D31', borderRadius: '6px' }}
                            itemStyle={{ color: '#EEEEF0' }}
                            labelStyle={{ color: '#8A8F98' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#5E6AD2" 
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Timeline List */}
             <div className="relative border-l border-border ml-3 space-y-8 pb-8">
                {data.artifacts.map((artifact, idx) => (
                    <motion.div 
                        key={artifact.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="ml-6 relative"
                    >
                        {/* Dot */}
                        <div className="absolute -left-7.75 top-1.5 size-3 rounded-full bg-background border-2 border-primary" />
                        
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground font-mono">
                                {new Date(artifact.created_at).toLocaleString(undefined, {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                            <div className="p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-colors group">
                                <div className="flex items-center justify-between gap-4">
                                    <h4 className="text-sm font-medium text-foreground line-clamp-1">
                                        {artifact.title || artifact.url}
                                    </h4>
                                    <a 
                                        href={artifact.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                                    >
                                        <ExternalLink className="size-4" />
                                    </a>
                                </div>
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <span className="px-1.5 py-0.5 rounded bg-background border border-border">
                                        {artifact.domain}
                                    </span>
                                    <span className={
                                        artifact.engagement_level === 'saturated' ? 'text-amber-500' :
                                        artifact.engagement_level === 'engaged' ? 'text-emerald-500' :
                                        'text-muted-foreground'
                                    }>
                                        {artifact.engagement_level}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
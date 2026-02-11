'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface HeatmapDay {
    date: string;
    count: number;
}

interface ActivityHeatmapProps {
    data: HeatmapDay[];
    weeks?: number;
    className?: string;
}

const COLORS = [
    'bg-muted/20',       // 0
    'bg-primary/20',     // 1
    'bg-primary/40',     // 2-3
    'bg-primary/60',     // 4-5
    'bg-primary/80',     // 6+
];

function getColor(count: number): string {
    if (count === 0) return COLORS[0];
    if (count === 1) return COLORS[1];
    if (count <= 3) return COLORS[2];
    if (count <= 5) return COLORS[3];
    return COLORS[4];
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export function ActivityHeatmap({ data, weeks = 13, className = '' }: ActivityHeatmapProps) {
    const grid = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const totalDays = weeks * 7;

        // Create a map of date -> count
        const dateMap = new Map<string, number>();
        data.forEach((d) => dateMap.set(d.date, d.count));

        // Build grid columns (weeks), rows (days)
        const columns: { date: string; count: number; day: number }[][] = [];
        let currentColumn: { date: string; count: number; day: number }[] = [];

        for (let i = totalDays - 1; i >= 0; i--) {
            const date = new Date(today.getTime() - i * 86400000);
            const dateStr = date.toISOString().split('T')[0];
            const dow = date.getDay();
            const count = dateMap.get(dateStr) ?? 0;

            currentColumn.push({ date: dateStr, count, day: dow });

            if (dow === 6 || i === 0) {
                columns.push(currentColumn);
                currentColumn = [];
            }
        }

        return columns;
    }, [data, weeks]);

    const monthLabels = useMemo(() => {
        const labels: { label: string; col: number }[] = [];
        let lastMonth = -1;

        grid.forEach((col, colIdx) => {
            const date = new Date(col[0].date);
            const month = date.getMonth();
            if (month !== lastMonth) {
                labels.push({
                    label: date.toLocaleString('default', { month: 'short' }),
                    col: colIdx,
                });
                lastMonth = month;
            }
        });

        return labels;
    }, [grid]);

    return (
        <div className={className}>
            {/* Month labels */}
            <div className="flex ml-8 mb-1 text-[10px] text-muted-foreground">
                {monthLabels.map((m, i) => (
                    <span
                        key={i}
                        style={{ marginLeft: i === 0 ? `${m.col * 14}px` : `${(m.col - (monthLabels[i - 1]?.col ?? 0) - 1) * 14}px` }}
                    >
                        {m.label}
                    </span>
                ))}
            </div>

            <div className="flex gap-0.5">
                {/* Day labels */}
                <div className="flex flex-col gap-0.5 pr-1">
                    {DAY_LABELS.map((label, i) => (
                        <div key={i} className="h-3 w-6 text-[10px] text-muted-foreground text-right leading-3">
                            {label}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex gap-0.5">
                    {grid.map((col, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-0.5">
                            {col.map((cell, cellIdx) => (
                                <motion.div
                                    key={cell.date}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: (colIdx * 7 + cellIdx) * 0.002 }}
                                    className={`h-3 w-3 rounded-[2px] ${getColor(cell.count)} transition-colors`}
                                    title={`${cell.date}: ${cell.count} artifact${cell.count !== 1 ? 's' : ''}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center gap-1 ml-8 text-[10px] text-muted-foreground">
                <span>Less</span>
                {COLORS.map((color, i) => (
                    <div key={i} className={`h-2.5 w-2.5 rounded-[1px] ${color}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

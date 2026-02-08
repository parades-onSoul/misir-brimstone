'use client';

import { motion } from 'framer-motion';


// ============ State Distribution Bar ============

interface StateDistributionBarProps {
    distribution: Record<string, number>;
    className?: string;
}

const ENGAGEMENT_COLORS: Record<string, string> = {
    latent: '#737373',        // neutral-500
    discovered: '#3b82f6',    // blue-500
    engaged: '#22c55e',       // green-500
    saturated: '#a855f7',     // purple-500
};

const ENGAGEMENT_LABELS: Record<string, string> = {
    latent: 'Latent',
    discovered: 'Discovered',
    engaged: 'Engaged',
    saturated: 'Saturated',
};

export function StateDistributionBar({ distribution, className = '' }: StateDistributionBarProps) {
    const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);
    if (total === 0) return null;

    const segments = Object.entries(distribution)
        .filter(([, count]) => count > 0)
        .map(([level, count]) => ({
            level,
            count,
            percentage: (count / total) * 100,
            color: ENGAGEMENT_COLORS[level] || '#555',
            label: ENGAGEMENT_LABELS[level] || level,
        }));

    return (
        <div className={className}>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
                {segments.map((seg, i) => (
                    <motion.div
                        key={seg.level}
                        initial={{ width: 0 }}
                        animate={{ width: `${seg.percentage}%` }}
                        transition={{ delay: i * 0.1, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                        className="h-full"
                        style={{ backgroundColor: seg.color }}
                        title={`${seg.label}: ${seg.count} (${Math.round(seg.percentage)}%)`}
                    />
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
                {segments.map((seg) => (
                    <div key={seg.level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: seg.color }}
                        />
                        <span>{seg.label}</span>
                        <span className="font-medium text-foreground">{seg.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============ Activity Sparkline ============

interface ActivitySparklineProps {
    data: number[];
    color?: string;
    height?: number;
    className?: string;
}

export function ActivitySparkline({
    data,
    color = '#1e90ff',
    height = 32,
    className = '',
}: ActivitySparklineProps) {
    if (data.length === 0) return null;

    const max = Math.max(...data, 1);
    const width = data.length * 4;

    const points = data
        .map((value, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - (value / max) * height;
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={className}
        >
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <polyline
                points={`0,${height} ${points} ${width},${height}`}
                fill="url(#sparkline-gradient)"
                stroke="none"
            />
        </svg>
    );
}

// ============ Concentration Indicator ============

interface ConcentrationIndicatorProps {
    value: number; // 0 to 1
    label: string;
    className?: string;
}

export function ConcentrationIndicator({ value, label, className = '' }: ConcentrationIndicatorProps) {
    const circumference = 2 * Math.PI * 18;
    const offset = circumference * (1 - Math.min(value, 1));

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <svg width="44" height="44" viewBox="0 0 44 44">
                <circle
                    cx="22" cy="22" r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-muted/30"
                />
                <motion.circle
                    cx="22" cy="22" r="18"
                    fill="none"
                    stroke="#1e90ff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                    transform="rotate(-90 22 22)"
                />
                <text
                    x="22" y="26"
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-medium"
                >
                    {Math.round(value * 100)}%
                </text>
            </svg>
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    );
}

// ============ Stat Card ============

interface StatCardProps {
    label: string;
    value: string | number;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
    icon?: React.ReactNode;
}

export function StatCard({ label, value, change, trend, icon }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border bg-card p-4"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                {icon && <span className="text-muted-foreground">{icon}</span>}
            </div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
            {change && (
                <div className={`mt-1 text-xs ${trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground'
                    }`}>
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {change}
                </div>
            )}
        </motion.div>
    );
}

// ============ Domain Bar ============

interface DomainBarProps {
    domains: { domain: string; count: number }[];
    maxItems?: number;
}

export function DomainBar({ domains, maxItems = 5 }: DomainBarProps) {
    const sorted = [...domains].sort((a, b) => b.count - a.count).slice(0, maxItems);
    const maxCount = Math.max(...sorted.map((d) => d.count), 1);

    return (
        <div className="space-y-2">
            {sorted.map((item, i) => (
                <motion.div
                    key={item.domain}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                >
                    <span className="w-28 truncate text-xs text-muted-foreground">
                        {item.domain}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / maxCount) * 100}%` }}
                            transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                            className="h-full rounded-full bg-primary/60"
                        />
                    </div>
                    <span className="w-8 text-right text-xs font-medium">{item.count}</span>
                </motion.div>
            ))}
        </div>
    );
}

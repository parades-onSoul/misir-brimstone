'use client';

import { useGlobalAnalytics } from '@/lib/api/analytics';
import { useAuth } from '@/hooks/use-auth';
import { Activity, Target, TrendingUp, AlertCircle } from 'lucide-react';

/**
 * System Overview - Job 32
 * Displays key metrics from global analytics: total items, active spaces, overall focus, system health
 */
export function SystemOverview() {
    const { user } = useAuth();
    const { data, isLoading } = useGlobalAnalytics(user?.id);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-[#141517] border border-white/5 rounded-lg p-4 animate-pulse">
                        <div className="h-4 w-24 bg-white/10 rounded mb-2"></div>
                        <div className="h-8 w-16 bg-white/10 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const metrics = [
        {
            label: 'Total Items',
            value: data.overview.total_artifacts,
            icon: Activity,
            color: 'text-blue-400',
        },
        {
            label: 'Active Spaces',
            value: data.overview.active_spaces,
            icon: Target,
            color: 'text-green-400',
        },
        {
            label: 'Overall Focus',
            value: `${Math.round(data.overview.overall_focus * 100)}%`,
            icon: TrendingUp,
            color: 'text-purple-400',
        },
        {
            label: 'System Health',
            value: data.overview.system_health,
            icon: AlertCircle,
            color: data.overview.system_health === 'healthy' ? 'text-green-400' : 'text-amber-400',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                    <div key={metric.label} className="bg-[#141517] border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <Icon className={`size-4 ${metric.color}`} />
                            <span className="text-sm text-[#8A8F98]">{metric.label}</span>
                        </div>
                        <div className="text-2xl font-semibold text-[#EEEEF0]">{metric.value}</div>
                    </div>
                );
            })}
        </div>
    );
}

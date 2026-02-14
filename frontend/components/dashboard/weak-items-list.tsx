'use client';

import { useGlobalAnalytics } from '@/lib/api/analytics';
import { useAuth } from '@/hooks/use-auth';

/**
 * Weak Items List
 * Shows the 5 items with the lowest assignment margin across all spaces
 */
export function WeakItemsList() {
    const { user } = useAuth();
    const { data, isLoading } = useGlobalAnalytics(user?.id);

    if (isLoading) {
        return (
            <div className="bg-[#141517] border border-white/5 rounded-lg p-6">
                <div className="h-4 w-32 bg-white/10 rounded mb-4"></div>
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-white/5 rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data || !data.weak_items || data.weak_items.length === 0) {
        return (
            <div className="bg-[#141517] border border-white/5 rounded-lg p-6">
                <h3 className="text-sm font-medium text-[#EEEEF0] mb-4">Items Needing Review</h3>
                <div className="text-sm text-[#8A8F98] border border-dashed border-white/10 p-8 rounded-lg text-center">
                    All your items fit well into their spaces. Great work.
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#141517] border border-white/5 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#EEEEF0]">Items Needing Review</h3>
                <span className="text-xs text-[#8A8F98]">{data.weak_items.length} items</span>
            </div>

            <div className="space-y-3">
                {data.weak_items.map((item) => (
                    <div
                        key={item.id}
                        className="p-3 bg-[#0B0C0E] rounded-lg border border-white/5 hover:border-amber-500/30 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="text-sm text-[#EEEEF0] font-medium line-clamp-1">
                                {item.title}
                            </h4>
                            <span className="text-xs text-amber-400 shrink-0">
                                {Math.round(item.margin * 100)}% fit
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#8A8F98]">
                            <span className="px-2 py-0.5 bg-white/5 rounded">{item.space_name}</span>
                            <span>|</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {data.weak_items.length > 0 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs text-amber-500">
                        These items do not fit their spaces well. Consider creating new topic areas or reassigning them.
                    </p>
                </div>
            )}
        </div>
    );
}

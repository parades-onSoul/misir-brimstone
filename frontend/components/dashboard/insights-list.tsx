'use client';

import { Lightbulb, ArrowRight, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useInsights, useGenerateInsights } from '@/lib/api/insights';
import { useAuth } from '@/hooks/use-auth';
import type { Insight } from '@/types/api';

const severityConfig = {
    low: { color: 'text-[#8A8F98]', icon: Info, bg: 'bg-[#8A8F98]/10' },
    medium: { color: 'text-[#5E6AD2]', icon: Lightbulb, bg: 'bg-[#5E6AD2]/10' },
    high: { color: 'text-[#F5A524]', icon: AlertTriangle, bg: 'bg-[#F5A524]/10' },
    critical: { color: 'text-[#F31260]', icon: AlertTriangle, bg: 'bg-[#F31260]/10' },
};

export function InsightsList() {
    const { user } = useAuth();
    const { data: insights, isLoading } = useInsights(user?.id);
    const { mutate: generate, isPending: isGenerating } = useGenerateInsights();

    const handleGenerate = () => {
        if (user?.id) generate(user.id);
    };

    if (isLoading) {
         return (
             <div className="border border-white/5 rounded-lg bg-[#141517] p-4 space-y-4 animate-pulse">
                 <div className="h-4 w-24 bg-white/10 rounded" />
                 <div className="space-y-3">
                     <div className="h-16 bg-white/5 rounded" />
                     <div className="h-16 bg-white/5 rounded" />
                 </div>
             </div>
         );
    }

    // Empty state
    if (!insights || insights.length === 0) {
        return (
             <div className="border border-white/5 rounded-lg bg-[#141517] p-4 space-y-2">
                 <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Insights</h3>
                    <button 
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="text-[#8A8F98] hover:text-[#EEEEF0] transition-colors"
                    >
                        <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                    </button>
                 </div>
                 <p className="text-[13px] text-[#8A8F98]">
                    No new insights. Capture more content or run analysis.
                 </p>
            </div>
        );
    }

    return (
        <div className="border border-white/5 rounded-lg bg-[#141517] overflow-hidden">
             <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-[#141517]">
                 <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Insights</h3>
                 <button 
                    onClick={handleGenerate} 
                    disabled={isGenerating}
                    className="text-[#8A8F98] hover:text-[#EEEEF0] transition-colors"
                    title="Generate new insights"
                >
                    <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                </button>
             </div>
             
             <div className="divide-y divide-white/2">
                 {insights.map((insight: Insight) => {
                     const style = severityConfig[insight.severity as keyof typeof severityConfig] || severityConfig.medium;
                     const Icon = style.icon;
                     
                     return (
                        <div key={insight.id} className="p-4 hover:bg-white/2 transition-colors cursor-pointer group">
                             <div className="flex gap-3">
                                 <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.color}`}>
                                     <Icon size={14} strokeWidth={2} />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <h4 className={`text-[13px] font-medium mb-1 ${style.color}`}>{insight.headline}</h4>
                                     <p className="text-[12px] text-[#8A8F98] leading-relaxed line-clamp-2">
                                        {insight.description}
                                     </p>
                                     {insight.recommended_action && (
                                         <div className="mt-2 flex items-center text-[11px] text-[#5E6AD2] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                             {insight.recommended_action} <ArrowRight size={10} className="ml-1" />
                                         </div>
                                     )}
                                 </div>
                             </div>
                        </div>
                     );
                 })}
             </div>
        </div>
    );
}

'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { MisirSectionCards } from '@/components/dashboard/misir-section-cards';
import { InsightsList } from '@/components/dashboard/insights-list';
import { ChartAreaInteractive } from '@/components/chart-area-interactive';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutGrid, Search, TrendingUp, Activity, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const { user } = useAuth();
    const { data: spaces, isLoading } = useSpaces(user?.id);

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            
            {/* 1. Header (Sticky) */}
            <header className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B0C0E]/80 backdrop-blur-md sticky top-0 z-10">
                <nav className="flex items-center gap-2 text-[13px]">
                    <Activity className="size-4 text-[#8A8F98]" strokeWidth={1.5} />
                    <span className="text-[#8A8F98]">Workspace</span>
                    <span className="text-[#5F646D]">/</span>
                    <span className="text-[#EEEEF0] font-medium">Dashboard</span>
                </nav>

                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-[#8A8F98] hover:text-[#EEEEF0] hover:bg-white/5 text-[13px] font-medium transition-colors"
                    >
                        Customize
                    </Button>
                </div>
            </header>

            {/* 2. Content Canvas */}
            <div className="p-6 space-y-6">
                
                {/* Hero / Overview Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <MisirSectionCards spaces={spaces} isLoading={isLoading} />
                </motion.div>
                
                {/* Activity & Recent */}
                <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
                    
                    {/* Activity Graph */}
                    <div className="border border-white/5 rounded-lg bg-[#141517] overflow-hidden flex flex-col h-[320px]">
                        <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-[#141517]">
                            <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Engagement</h3>
                            <button className="text-[11px] text-[#8A8F98] hover:text-[#EEEEF0] transition-colors">
                                Last 90 Days
                            </button>
                        </div>
                        <div className="flex-1 p-0 relative">
                             {/* Graph Component - Ensure it fits transparently */}
                            <ChartAreaInteractive /> 
                        </div>
                    </div>

                    {/* Recent Lists (Dense) */}
                    <div className="space-y-6">
                        
                        {/* Recent Artifacts */}
                        <div className="border border-white/5 rounded-lg bg-[#141517] overflow-hidden">
                            <div className="h-10 flex items-center justify-between px-4 border-b border-white/5">
                                <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Recent</h3>
                            </div>
                            <div className="divide-y divide-white/[0.02]">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-9 flex items-center px-4 hover:bg-white/[0.02] cursor-pointer group transition-colors">
                                        <div className="size-2 rounded-full bg-[#5E6AD2]/20 border border-[#5E6AD2]/30 mr-3" />
                                        <span className="text-[13px] text-[#8A8F98] group-hover:text-[#EEEEF0] truncate flex-1">
                                            React Server Components
                                        </span>
                                        <span className="text-[11px] text-[#5F646D]">2m</span>
                                    </div>
                                ))}
                                <div className="h-9 flex items-center px-4 justify-center hover:bg-white/[0.02] cursor-pointer border-t border-white/5">
                                    <span className="text-[11px] text-[#5F646D]">View all history</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="border border-white/5 rounded-lg bg-[#141517] p-4 space-y-2">
                             <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider mb-2">Details</h3>
                             <p className="text-[13px] text-[#8A8F98] leading-relaxed">
                                Your knowledge base is growing. You have captured items across 4 spaces this week.
                             </p>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}

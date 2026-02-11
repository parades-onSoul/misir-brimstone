"use client"

import { SpaceListResponse } from "@/types/api"

interface MisirSectionCardsProps {
  spaces: SpaceListResponse | undefined
  isLoading: boolean
}

// Interface for MetricCard props
interface MetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  status: string;
}

// Extracted component to avoid re-creation during render
const MetricCard = ({ label, value, subtext, status }: MetricCardProps) => (
  <div className="bg-[#0B0C0E] p-5 hover:bg-[#141517] transition-colors group flex flex-col justify-between min-h-35">
      <div className="space-y-1">
          <span className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">{label}</span>
          <div className="flex items-center justify-between">
              <span className="text-3xl font-semibold text-[#EEEEF0] tabular-nums tracking-tight">{value}</span>
              {status && (
                  <span className="inline-flex items-center h-5 px-1.5 rounded bg-white/5 text-[11px] font-medium text-[#8A8F98] border border-white/10">
                      {status}
                  </span>
              )}
          </div>
      </div>
      <div className="pt-4 border-t border-white/2 mt-auto">
           <p className="text-[13px] text-[#8A8F98] truncate">{subtext}</p>
      </div>
  </div>
);

export function MisirSectionCards({ spaces, isLoading }: MisirSectionCardsProps) {
  // Calculate metrics
  const spaceCount = spaces?.count ?? 0
  const totalArtifacts = spaces?.spaces.reduce((sum, s) => sum + s.artifact_count, 0) ?? 0
  const velocityScore = totalArtifacts > 0 ? Math.min(100, Math.round((totalArtifacts / 10) * 100)) : 0
  const driftScore = 65

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#0B0C0E] p-5 space-y-3">
             <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
             <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden shadow-sm">
      <MetricCard 
        label="Total Spaces" 
        value={spaceCount} 
        subtext="Knowledge domains tracked"
        status="Active"
      />
      <MetricCard 
        label="Items" 
        value={totalArtifacts} 
        subtext="Resources saved"
        status="+12%"
      />
      <MetricCard 
        label="Velocity" 
        value={`${velocityScore}%`} 
        subtext="Learning momentum"
        status="Stable"
      />
      <MetricCard 
        label="Focus Spread" 
        value={`${driftScore}%`} 
        subtext="How focused you are"
        status="Safe"
      />
    </div>
  )
}

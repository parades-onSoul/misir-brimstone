"use client"

import * as React from "react"
import { ArrowRight, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Space {
  id: string
  name: string
  emoji?: string
  color?: string
  artifactCount?: number
  lastActivity?: string
  subspaces?: {
    id: string
    name: string
    evidence?: number
  }[]
}

interface SpaceCardsProps {
  className?: string
  spaces: Space[]
  loading?: boolean
}

export function SpaceCards({ className, spaces, loading }: SpaceCardsProps) {
  if (loading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-20 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div 
              key={i}
              className="h-24 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (spaces.length === 0) {
    return null
  }

  // Show max 6 spaces
  const displaySpaces = spaces.slice(0, 6)
  const hasMore = spaces.length > 6

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[var(--font-size-mini)] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Your Spaces
        </span>
        {hasMore && (
          <Link 
            href="/dashboard/spaces"
            className="flex items-center gap-1 text-[var(--font-size-mini)] text-[var(--color-text-quaternary)] hover:text-[var(--color-text-tertiary)] transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {displaySpaces.map(space => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </div>
  )
}

function SpaceCard({ space }: { space: Space }) {
  const subspaceCount = space.subspaces?.length ?? 0
  
  // Calculate mini blob positions based on evidence
  const topSubspaces = (space.subspaces || [])
    .sort((a, b) => (b.evidence ?? 0) - (a.evidence ?? 0))
    .slice(0, 4)

  return (
    <Link
      href={`/dashboard/spaces/${space.id}`}
      className="group flex flex-col p-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-secondary)] transition-all"
    >
      <div className="flex items-center gap-2.5 mb-3">
        {space.emoji ? (
          <span className="text-lg">{space.emoji}</span>
        ) : (
          <span 
            className="h-6 w-6 rounded"
            style={{ backgroundColor: space.color || 'var(--chart-3)' }}
          />
        )}
        <span className="text-[var(--font-size-small)] font-medium text-[var(--color-text-primary)] truncate flex-1">
          {space.name}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-[var(--color-text-quaternary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>

      {/* Mini 4-blob preview */}
      <div className="relative h-16 mb-3 rounded bg-[var(--color-bg-primary)]/50">
        <MiniBlobs subspaces={topSubspaces} />
      </div>

      <div className="flex items-center gap-4 text-[var(--font-size-mini)] text-[var(--color-text-tertiary)]">
        <span>{space.artifactCount ?? 0} artifacts</span>
        <span>{subspaceCount} subspaces</span>
        {space.lastActivity && (
          <span className="ml-auto flex items-center gap-1 text-[var(--color-text-quaternary)]">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(space.lastActivity)}
          </span>
        )}
      </div>
    </Link>
  )
}

function MiniBlobs({ subspaces }: { subspaces: { id: string; name: string; evidence?: number }[] }) {
  // Position 4 blobs in a simple layout
  const positions = [
    { x: 25, y: 50 },  // left
    { x: 75, y: 50 },  // right
    { x: 50, y: 25 },  // top
    { x: 50, y: 75 },  // bottom
  ]

  const colors = [
    'var(--chart-1)',
    'var(--chart-2)', 
    'var(--chart-3)',
    'var(--chart-4)',
  ]

  if (subspaces.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[var(--font-size-micro)] text-[var(--color-text-quaternary)]">
          No subspaces yet
        </span>
      </div>
    )
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {subspaces.map((subspace, i) => {
        const pos = positions[i]
        const evidence = subspace.evidence ?? 0
        // Size based on evidence (6-16 radius) - bigger than before
        const radius = 6 + (evidence / 10) * 10
        const opacity = 0.5 + (evidence / 10) * 0.4

        return (
          <circle
            key={subspace.id}
            cx={pos.x}
            cy={pos.y}
            r={radius}
            fill={colors[i]}
            opacity={opacity}
          />
        )
      })}
      
      {/* Center dot representing the space core */}
      <circle
        cx={50}
        cy={50}
        r={3}
        fill="var(--color-text-quaternary)"
        opacity={0.6}
      />
    </svg>
  )
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return `${Math.floor(diffDays / 7)}w`
}

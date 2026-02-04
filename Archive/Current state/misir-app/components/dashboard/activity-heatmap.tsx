"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface HeatmapDay {
  date: string // YYYY-MM-DD
  count: number
  types: {
    ambient: number
    engaged: number
    committed: number
  }
}

interface ActivityHeatmapProps {
  className?: string
  data: HeatmapDay[]
  loading?: boolean
  weeks?: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getIntensityClass(count: number): string {
  if (count === 0) return "bg-[var(--color-bg-tertiary)]"
  if (count <= 2) return "bg-emerald-900/40"
  if (count <= 5) return "bg-emerald-700/60"
  if (count <= 10) return "bg-emerald-500/80"
  return "bg-emerald-400"
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

function generateEmptyWeeks(weeks: number): HeatmapDay[][] {
  const result: HeatmapDay[][] = []
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (weeks * 7) + 1)
  
  // Adjust to start on Sunday
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)
  
  const currentDate = new Date(startDate)
  
  for (let week = 0; week < weeks; week++) {
    const weekData: HeatmapDay[] = []
    for (let day = 0; day < 7; day++) {
      const dateStr = currentDate.toISOString().split('T')[0]
      weekData.push({
        date: dateStr,
        count: 0,
        types: { ambient: 0, engaged: 0, committed: 0 }
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }
    result.push(weekData)
  }
  
  return result
}

function mergeData(emptyWeeks: HeatmapDay[][], data: HeatmapDay[]): HeatmapDay[][] {
  const dataMap = new Map(data.map(d => [d.date, d]))
  
  return emptyWeeks.map(week => 
    week.map(day => dataMap.get(day.date) || day)
  )
}

function getMonthLabels(weeks: HeatmapDay[][]): { month: string; position: number }[] {
  const labels: { month: string; position: number }[] = []
  let lastMonth = -1
  
  weeks.forEach((week, weekIndex) => {
    // Check first day of each week
    const firstDay = week[0]
    if (firstDay) {
      const date = new Date(firstDay.date)
      const month = date.getMonth()
      if (month !== lastMonth) {
        labels.push({ month: MONTHS[month], position: weekIndex })
        lastMonth = month
      }
    }
  })
  
  return labels
}

export function ActivityHeatmap({ 
  className, 
  data = [], 
  loading = false,
  weeks = 12 
}: ActivityHeatmapProps) {
  const emptyWeeks = React.useMemo(() => generateEmptyWeeks(weeks), [weeks])
  const mergedWeeks = React.useMemo(() => mergeData(emptyWeeks, data), [emptyWeeks, data])
  const monthLabels = React.useMemo(() => getMonthLabels(mergedWeeks), [mergedWeeks])
  
  const totalArtifacts = React.useMemo(
    () => data.reduce((sum, d) => sum + d.count, 0),
    [data]
  )

  if (loading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: weeks }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="w-3 h-3 rounded-sm" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Activity
        </h3>
        <span className="text-xs text-muted-foreground">
          {totalArtifacts} artifacts in {weeks} weeks
        </span>
      </div>
      
      {/* Month labels */}
      <div className="flex mb-1 ml-8">
        <div className="flex relative w-full">
          {monthLabels.map(({ month, position }, i) => (
            <span 
              key={i}
              className="text-[10px] text-muted-foreground absolute"
              style={{ left: `${(position / weeks) * 100}%` }}
            >
              {month}
            </span>
          ))}
        </div>
      </div>
      
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAYS.map((day, i) => (
            <div 
              key={day} 
              className="h-3 flex items-center"
            >
              {i % 2 === 1 && (
                <span className="text-[10px] text-muted-foreground w-6">
                  {day}
                </span>
              )}
            </div>
          ))}
        </div>
        
        {/* Heatmap grid */}
        <TooltipProvider delayDuration={100}>
          <div className="flex gap-0.5 overflow-x-auto">
            {mergedWeeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((day, dayIndex) => {
                  const isToday = day.date === new Date().toISOString().split('T')[0]
                  const isFuture = new Date(day.date) > new Date()
                  
                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-sm transition-colors cursor-pointer",
                            isFuture 
                              ? "bg-transparent" 
                              : getIntensityClass(day.count),
                            isToday && "ring-1 ring-[var(--color-text-primary)] ring-offset-1 ring-offset-[var(--color-bg-primary)]"
                          )}
                        />
                      </TooltipTrigger>
                      {!isFuture && (
                        <TooltipContent 
                          side="top" 
                          className="text-xs"
                        >
                          <div className="font-medium">{formatDate(day.date)}</div>
                          <div className="text-muted-foreground">
                            {day.count === 0 ? 'No artifacts' : `${day.count} artifact${day.count !== 1 ? 's' : ''}`}
                          </div>
                          {day.count > 0 && (
                            <div className="flex gap-2 mt-1 text-[10px]">
                              {day.types.ambient > 0 && (
                                <span className="text-blue-400">{day.types.ambient} ambient</span>
                              )}
                              {day.types.engaged > 0 && (
                                <span className="text-amber-400">{day.types.engaged} engaged</span>
                              )}
                              {day.types.committed > 0 && (
                                <span className="text-emerald-400">{day.types.committed} committed</span>
                              )}
                            </div>
                          )}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </TooltipProvider>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[10px] text-muted-foreground mr-1">Less</span>
        <div className="w-3 h-3 rounded-sm bg-[var(--color-bg-tertiary)]" />
        <div className="w-3 h-3 rounded-sm bg-emerald-900/40" />
        <div className="w-3 h-3 rounded-sm bg-emerald-700/60" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400" />
        <span className="text-[10px] text-muted-foreground ml-1">More</span>
      </div>
    </div>
  )
}

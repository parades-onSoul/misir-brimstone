"use client"

import { IconTrendingDown, IconTrendingUp, IconMinus } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpaceListResponse } from "@/types/api"

interface MisirSectionCardsProps {
  spaces: SpaceListResponse | undefined
  isLoading: boolean
}

export function MisirSectionCards({ spaces, isLoading }: MisirSectionCardsProps) {
  // Calculate metrics
  const spaceCount = spaces?.count ?? 0
  const totalArtifacts = spaces?.spaces.reduce((sum, s) => sum + s.artifact_count, 0) ?? 0
  
  // Mock velocity and drift for now (these would come from analytics endpoint)
  const velocityScore = totalArtifacts > 0 ? Math.min(100, Math.round((totalArtifacts / 10) * 100)) : 0
  const driftScore = 65

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Total Spaces */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Spaces</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {spaceCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {spaceCount > 5 ? <IconTrendingUp /> : <IconMinus />}
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Knowledge domains tracked
          </div>
          <div className="text-muted-foreground">
            Organizing your information
          </div>
        </CardFooter>
      </Card>

      {/* Total Artifacts */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Artifacts Captured</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalArtifacts}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {totalArtifacts > 50 ? <IconTrendingUp /> : <IconTrendingDown />}
              {totalArtifacts > 50 ? '+' : ''}
              {totalArtifacts > 50 ? '12%' : 'Growing'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Content pieces indexed
          </div>
          <div className="text-muted-foreground">
            Building your knowledge base
          </div>
        </CardFooter>
      </Card>

      {/* Velocity Score */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Exploration Velocity</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {velocityScore}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Learning momentum
          </div>
          <div className="text-muted-foreground">
            Based on capture frequency
          </div>
        </CardFooter>
      </Card>

      {/* Drift Score */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Knowledge Drift</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {driftScore}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconMinus />
              Moderate
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Attention spread
          </div>
          <div className="text-muted-foreground">
            Tracking focus distribution
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

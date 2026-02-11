'use client';

import { useSpaceAnalytics, useSpaceVelocity } from '@/lib/api/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VelocityPoint } from '@/types/api';

interface SpaceHealthProps {
  spaceId: number;
  userId: string;
}

export function SpaceHealth({ spaceId, userId }: SpaceHealthProps) {
  const { data: analytics, isLoading: analyticsLoading } = useSpaceAnalytics(spaceId, userId);
  const { data: velocityHistory, isLoading: velocityLoading } = useSpaceVelocity(spaceId, userId);

  if (analyticsLoading || velocityLoading) {
     return <HealthSkeleton />;
  }

  // Focus Level Calculation
  const avgConfidence = analytics?.subspace_health 
    ? analytics.subspace_health.reduce((acc, s) => acc + s.confidence, 0) / (analytics.subspace_health.length || 1)
    : 0;
  
  const focusLabel = getFocusLabel(avgConfidence);
  const focusDots = Math.max(1, Math.round(avgConfidence * 5)); // 1-5 scale

  // Progress & Consistency from Velocity
  const progress = calculateProgress(velocityHistory);
  const consistency = calculateConsistency(velocityHistory);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">How You&apos;re Doing</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
          {/* Focus Section */}
          <div>
            <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Focus</span>
                <span className="text-sm font-bold text-primary">{focusLabel}</span>
            </div>
            <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                        key={i} 
                        className={`h-2.5 flex-1 rounded-full ${i <= focusDots ? 'bg-primary' : 'bg-muted/40'}`}
                    />
                ))}
            </div>
          </div>

          {/* Consistency Section */}
          <div className="flex justify-between items-center border-t pt-4">
             <div>
                <span className="text-sm font-medium text-muted-foreground block">Consistency</span>
                <span className="text-xs text-muted-foreground">Velocity stability</span>
             </div>
             <span className={`font-bold ${getConsistencyColor(consistency)}`}>{consistency}</span>
          </div>

          {/* Progress Section */}
          <div className="flex justify-between items-center border-t pt-4">
             <div>
                <span className="text-sm font-medium text-muted-foreground block">Progress</span>
                <span className="text-xs text-muted-foreground">Avg. items / week</span>
             </div>
             <span className="font-bold text-2xl">{progress}</span>
          </div>
      </CardContent>
    </Card>
  );
}

function HealthSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="grid gap-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    )
}

// Helpers
function getFocusLabel(c: number) {
    if (c > 0.8) return 'Locked In';
    if (c > 0.6) return 'Deep Work';
    if (c > 0.4) return 'Exploratory';
    if (c > 0.2) return 'Scattered';
    return 'Just Starting';
}

function calculateProgress(history: VelocityPoint[] | undefined) {
    if (!history || history.length === 0) return '0';
    // Take average of available history up to 4 points
    const recent = history.slice(0, 4);
    const avg = recent.reduce((sum, item) => sum + item.velocity, 0) / (recent.length || 1);
    // If exact 0, return 0.
    if (avg < 1 && avg > 0) return '< 1';
    return Math.round(avg).toString();
}

function calculateConsistency(history: VelocityPoint[] | undefined) {
    if (!history || history.length < 3) return 'Building...';
    
    const recent = history.slice(0, 4).map(h => h.velocity);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    if (avg === 0) return 'Inactive';

    const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;
    
    if (cv < 0.2) return 'Excellent';
    if (cv < 0.5) return 'Good';
    return 'Uneven';
}

function getConsistencyColor(status: string) {
    if (status === 'Excellent') return 'text-green-600 dark:text-green-400';
    if (status === 'Good') return 'text-blue-600 dark:text-blue-400';
    if (status === 'Uneven') return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
}

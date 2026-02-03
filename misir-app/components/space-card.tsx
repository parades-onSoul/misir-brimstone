'use client';

import type { Space } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSpaceStore } from '@/lib/store';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import { SpaceDetailsModal } from './space-details-modal';

interface SpaceCardProps {
  space: Space;
}

const STATE_LABELS = ['Undiscovered', 'Discovered', 'Explored', 'Mastered'] as const;
const STATE_COLORS = [
  'bg-gray-500/20 text-gray-300',
  'bg-blue-500/20 text-blue-300',
  'bg-purple-500/20 text-purple-300',
  'bg-green-500/20 text-green-300',
] as const;

export function SpaceCard({ space }: SpaceCardProps) {
  const { selectSpace } = useSpaceStore();
  const [showDetails, setShowDetails] = useState(false);
  
  // Get dominant state
  const stateVector = space.stateVector || [10, 0, 0, 0];
  const dominantIndex = stateVector.indexOf(
    Math.max(...stateVector)
  ) as 0 | 1 | 2 | 3;

  return (
    <>
      <Card 
        className="cursor-pointer transition-all hover:border-primary/50"
        onClick={() => selectSpace(space.id)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{space.name}</CardTitle>
              {space.intention && (
                <CardDescription className="mt-1 line-clamp-2">
                  {space.intention}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(true);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Badge className={STATE_COLORS[dominantIndex]} variant="secondary">
                {STATE_LABELS[dominantIndex]}
              </Badge>
            </div>
          </div>
        </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Subspaces */}
          {space.subspaces && space.subspaces.length > 0 ? (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Subspaces</div>
              <div className="flex flex-wrap gap-1">
                {space.subspaces.slice(0, 5).map((subspace, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {typeof subspace === 'string' ? subspace : subspace.name}
                  </Badge>
                ))}
                {space.subspaces.length > 5 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{space.subspaces.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Subspaces</div>
              <div className="text-xs text-muted-foreground italic">
                No subspaces available for this domain
              </div>
            </div>
          )}

          {/* Evidence Score */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Evidence</div>
            <div className="text-2xl font-semibold">{(space.evidence || 0).toFixed(1)}</div>
          </div>

          {/* State Vector Visualization */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">State Distribution</div>
            <div className="flex gap-1 h-2">
              {stateVector.map((mass, idx) => (
                <div
                  key={idx}
                  className="rounded-sm transition-all"
                  style={{
                    width: `${(mass / 10) * 100}%`,
                    backgroundColor: [
                      'rgb(107, 114, 128)',
                      'rgb(59, 130, 246)',
                      'rgb(168, 85, 247)',
                      'rgb(34, 197, 94)',
                    ][idx],
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {stateVector.map((mass, idx) => (
                <span key={idx}>{mass}</span>
              ))}
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-xs text-muted-foreground">
            Updated {new Date(space.lastUpdatedAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>

    <SpaceDetailsModal
      space={space}
      open={showDetails}
      onOpenChange={setShowDetails}
    />
    </>
  );
}

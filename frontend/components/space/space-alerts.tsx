'use client';

import { useSpaceAlerts } from '@/lib/api/analytics';
import { SmartAlert } from '@/types/api';
import { AlertTriangle, Lightbulb, RefreshCw, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface SpaceAlertsProps {
  spaceId: number;
  userId: string;
}

const ALERT_ICONS: Record<string, LucideIcon> = {
  low_margin: Lightbulb,
  high_drift: RefreshCw,
  velocity_drop: TrendingDown,
  confidence_drop: AlertTriangle,
  default: Lightbulb,
};

export function SpaceAlerts({ spaceId, userId }: SpaceAlertsProps) {
  const { data: alerts, isLoading } = useSpaceAlerts(spaceId, userId);

  if (isLoading || !alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      {alerts.map((alert, index) => (
        <AlertCard key={index} alert={alert} spaceId={spaceId} />
      ))}
    </div>
  );
}

function AlertCard({ alert, spaceId }: { alert: SmartAlert; spaceId: number }) {
  // Determine style based on severity/type
  const isWarning = alert.severity === 'warning' || alert.severity === 'danger';
  const bgColor = isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-blue-50 dark:bg-blue-950/20';
  const borderColor = isWarning ? 'border-amber-200 dark:border-amber-900' : 'border-blue-200 dark:border-blue-900';
  const iconColor = isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400';

  const Icon = ALERT_ICONS[alert.type] ?? ALERT_ICONS.default;

  return (
    <Card className={`border ${borderColor} ${bgColor}`}>
      <CardContent className="p-4 flex gap-4">
        <div className={`mt-1 ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-line mb-3">
            {alert.message}
          </p>
          
          <div className="flex gap-2">
             {/* Dynamic actions based on type could go here. For now, specific links. */}
             {alert.type === 'low_margin' && (
                <Button variant="outline" size="sm" asChild className="h-8 text-xs bg-background">
                    <Link href={`/dashboard/spaces/${spaceId}?tab=library&filter=unassigned`}>
                        Review Items
                    </Link>
                </Button>
             )}
             {alert.type === 'high_drift' && (
                <Button variant="outline" size="sm" asChild className="h-8 text-xs bg-background">
                     <Link href={`/dashboard/spaces/${spaceId}?tab=map`}>
                        See what changed
                    </Link>
                </Button>
             )}
              {alert.type === 'confidence_drop' && (
                <Button variant="outline" size="sm" asChild className="h-8 text-xs bg-background">
                     <Link href={`/dashboard/spaces/${spaceId}?tab=overview&action=split`}>
                        Review Topics
                    </Link>
                </Button>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Icon lookup hoisted to avoid recreating components during render

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/db/supabase';
import { cn } from '@/lib/utils';
import { getTimeAgo } from '@/lib/utils/index';
import { useSpaceStore } from '@/lib/store';
import { Activity, ExternalLink, X, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface LiveArtifact {
  id: string;
  title: string;
  url: string;
  space_id: string;
  artifact_type: 'ambient' | 'engaged' | 'committed';
  relevance: number;
  created_at: string;
}

interface LiveActivityProps {
  className?: string;
  maxItems?: number;
  onNewArtifact?: (artifact: LiveArtifact) => void;
}

const TYPE_VARIANTS = {
  ambient: 'secondary',
  engaged: 'outline',
  committed: 'default',
} as const;

const TYPE_LABELS = {
  ambient: 'Browsed',
  engaged: 'Saved',
  committed: 'Noted',
} as const;

/**
 * LiveActivity - Real-time indicator showing when extension captures artifacts
 * 
 * Uses Supabase Realtime to subscribe to artifact inserts.
 * Shows a subtle pulse animation and optional toast-style notifications.
 */
export function LiveActivity({
  className,
  maxItems = 5,
  onNewArtifact
}: LiveActivityProps) {
  const { spaces } = useSpaceStore();
  const [recentArtifacts, setRecentArtifacts] = useState<LiveArtifact[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [latestArtifact, setLatestArtifact] = useState<LiveArtifact | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get space name from id
  const getSpaceName = useCallback((spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    return space?.name || 'Unknown Space';
  }, [spaces]);

  // Handle new artifact arrival
  const handleNewArtifact = useCallback((artifact: LiveArtifact) => {
    // Add to recent list (prepend)
    setRecentArtifacts(prev => {
      const updated = [artifact, ...prev.filter(a => a.id !== artifact.id)];
      return updated.slice(0, maxItems);
    });

    // Trigger pulse animation
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 1000);

    // Show notification toast
    setLatestArtifact(artifact);
    setShowNotification(true);

    // Clear previous timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Auto-hide notification after 4 seconds
    notificationTimeoutRef.current = setTimeout(() => {
      setShowNotification(false);
    }, 4000);

    // Callback
    onNewArtifact?.(artifact);
  }, [maxItems, onNewArtifact]);

  // Subscribe to realtime artifact inserts
  useEffect(() => {
    // Get user ID from auth
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create channel for artifact inserts
      const channel = supabase
        .channel('artifacts-live')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'artifacts',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const artifact = payload.new as LiveArtifact;
            handleNewArtifact(artifact);
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });

      channelRef.current = channel;
    };

    setupSubscription();

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [handleNewArtifact]);

  // Dismiss notification
  const dismissNotification = () => {
    setShowNotification(false);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Connection Status Indicator */}
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={isConnected ? "default" : "secondary"} className="gap-1.5 text-xs">
          {isConnected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {isConnected ? 'Live' : 'Connecting...'}
        </Badge>

        {/* Pulse indicator */}
        {isPulsing && (
          <div className="relative">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          </div>
        )}
      </div>

      {/* Recent Artifacts List */}
      {recentArtifacts.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent Captures
          </h4>
          <ul className="space-y-1.5">
            {recentArtifacts.map((artifact) => (
              <li
                key={artifact.id}
                className="flex items-center gap-2 text-xs group"
              >
                <Badge variant={TYPE_VARIANTS[artifact.artifact_type]} className="text-[10px] px-1.5 py-0">
                  {TYPE_LABELS[artifact.artifact_type]}
                </Badge>
                <span className="truncate text-muted-foreground flex-1 min-w-0">
                  {artifact.title || 'Untitled'}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {getSpaceName(artifact.space_id)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-4">
          <Activity className="w-4 h-4 mx-auto mb-1.5 opacity-50" />
          <p>No recent activity</p>
          <p className="text-[10px] mt-1">Captures will appear here in real-time</p>
        </div>
      )}

      {/* Toast Notification */}
      {showNotification && latestArtifact && (
        <Card className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2 fade-in duration-200">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Badge variant={TYPE_VARIANTS[latestArtifact.artifact_type]} className="text-[10px]">
                  {TYPE_LABELS[latestArtifact.artifact_type]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {getSpaceName(latestArtifact.space_id)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 -mr-1 -mt-1"
                onClick={dismissNotification}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <CardTitle className="text-sm truncate mt-1">
              {latestArtifact.title || 'Untitled'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <Link href={latestArtifact.url} target="_blank">
                <ExternalLink className="w-3 h-3 mr-1" />
                Open
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * LiveActivityCompact - Minimal version for header/sidebar
 */
export function LiveActivityCompact({ className }: { className?: string }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('artifacts-compact')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'artifacts',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            setIsPulsing(true);
            setLastCaptureTime(new Date());
            setTimeout(() => setIsPulsing(false), 2000);
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });

      channelRef.current = channel;
    };

    setupSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Format relative time
  const getRelativeTime = () => {
    if (!lastCaptureTime) return null;
    const seconds = Math.floor((Date.now() - lastCaptureTime.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div className={cn(
          "w-2 h-2 rounded-full transition-colors",
          isConnected ? "bg-emerald-500" : "bg-muted-foreground"
        )} />
        {isPulsing && (
          <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {lastCaptureTime ? getRelativeTime() : (isConnected ? 'Live' : '...')}
      </span>
    </div>
  );
}

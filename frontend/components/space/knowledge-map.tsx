'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Application, Graphics, Container, Text } from 'pixi.js';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2, Minimize2, SlidersHorizontal, Play, Pause, CalendarClock } from 'lucide-react';
import { useSpaceTopology } from '@/lib/api/analytics';
import { TopologyNode, TopologySnapshot } from '@/types/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
    FOCUS_CONFIDENCE_HIGH_THRESHOLD,
    FOCUS_CONFIDENCE_MEDIUM_THRESHOLD,
} from '@/lib/focus-thresholds';

type ActivityFilter = 'all' | 'low' | 'medium' | 'high';
type DateRangeFilter = 'all' | '7d' | '30d' | '90d';

export interface MapFilters {
    confidenceRange: [number, number];
    activity: ActivityFilter;
    dateRange: DateRangeFilter;
}

export const MAP_FILTER_DEFAULTS: MapFilters = {
    confidenceRange: [0, 1],
    activity: 'all',
    dateRange: 'all',
};

const DATE_RANGE_TO_MS: Record<Exclude<DateRangeFilter, 'all'>, number> = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
};

const formatSnapshotTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Live topology';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const getActivityBand = (count?: number | null): ActivityFilter => {
    if (typeof count !== 'number' || Number.isNaN(count)) return 'all';
    if (count >= 12) return 'high';
    if (count >= 6) return 'medium';
    return 'low';
};

const isWithinDateRange = (updatedAt: string | null | undefined, filter: DateRangeFilter): boolean => {
    if (filter === 'all') return true;
    if (!updatedAt) return false;
    const cutoff = DATE_RANGE_TO_MS[filter];
    const value = new Date(updatedAt).getTime();
    if (Number.isNaN(value)) return false;
    return Date.now() - value <= cutoff;
};

interface KnowledgeMapProps {
  spaceId: number;
  userId: string;
  className?: string;
  onNodeClick?: (node: TopologyNode) => void;
}

export function KnowledgeMap({ spaceId, userId, className, onNodeClick }: KnowledgeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
    const { data: topology, isLoading } = useSpaceTopology(spaceId, userId);
    const [zoom, setZoom] = useState(1);
        const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
    const [filters, setFilters] = useState<MapFilters>(MAP_FILTER_DEFAULTS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [activeSnapshotIndex, setActiveSnapshotIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);

    const snapshots = useMemo(() => {
        if (!topology) return [] as TopologySnapshot[];
        if (topology.history?.length) return topology.history;
        if (topology.nodes?.length) {
            return [
                {
                    timestamp: topology.metadata?.last_updated ?? new Date().toISOString(),
                    nodes: topology.nodes,
                },
            ];
        }
        return [] as TopologySnapshot[];
    }, [topology]);

    const fallbackNodes = useMemo(() => topology?.nodes ?? [], [topology]);

    const effectiveSnapshotIndex = useMemo(() => {
        if (!snapshots.length) return 0;
        if (activeSnapshotIndex < 0) return snapshots.length - 1;
        return Math.min(activeSnapshotIndex, snapshots.length - 1);
    }, [activeSnapshotIndex, snapshots.length]);

    const currentNodes = useMemo(() => {
        if (!snapshots.length) return fallbackNodes;
        return snapshots[effectiveSnapshotIndex]?.nodes ?? fallbackNodes;
    }, [snapshots, effectiveSnapshotIndex, fallbackNodes]);

    const layoutNodes = useMemo(() => {
        if (!snapshots.length) return fallbackNodes;
        const nodeMap = new Map<number, TopologyNode>();
        snapshots.forEach((snapshot) => {
            snapshot.nodes?.forEach((node) => {
                nodeMap.set(node.subspace_id, node);
            });
        });
        return nodeMap.size ? Array.from(nodeMap.values()) : fallbackNodes;
    }, [snapshots, fallbackNodes]);

    const filteredNodes = useMemo(() => {
        if (!currentNodes.length) return [] as TopologyNode[];
        return currentNodes.filter((node) => {
            const confidence = node.confidence ?? 0;
            const passesConfidence =
                confidence >= filters.confidenceRange[0] && confidence <= filters.confidenceRange[1];

            const activityCount = node.recent_artifact_count ?? node.artifact_count;
            const band = node.activity_band ?? getActivityBand(activityCount);
            const passesActivity = filters.activity === 'all' || band === filters.activity;

            const lastUpdated = node.last_active_at ?? node.updated_at ?? null;
            const passesDate = isWithinDateRange(lastUpdated, filters.dateRange);

            return passesConfidence && passesActivity && passesDate;
        });
    }, [currentNodes, filters]);

    const hoveredNode = useMemo(() => {
        if (hoveredNodeId === null) return null;
        return filteredNodes.find((node) => node.subspace_id === hoveredNodeId) ?? null;
    }, [hoveredNodeId, filteredNodes]);

    const totalNodes = currentNodes.length;
    const visibleNodes = filteredNodes.length;
    const isTimelinePlaying = isPlaying && snapshots.length > 1;

    useEffect(() => {
            if (!isTimelinePlaying) return undefined;
            const interval = window.setInterval(() => {
                setActiveSnapshotIndex((prev) => {
                    const start = prev < 0 ? snapshots.length - 1 : prev;
                    return (start + 1) % snapshots.length;
                });
            }, 1800);
            return () => window.clearInterval(interval);
        }, [isTimelinePlaying, snapshots.length]);

    const filtersActive =
        filters.activity !== MAP_FILTER_DEFAULTS.activity ||
        filters.dateRange !== MAP_FILTER_DEFAULTS.dateRange ||
        filters.confidenceRange[0] !== MAP_FILTER_DEFAULTS.confidenceRange[0] ||
        filters.confidenceRange[1] !== MAP_FILTER_DEFAULTS.confidenceRange[1];

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return;

    let app: Application | null = null;
    let isDisposed = false;
    const cleanupListeners: Array<() => void> = [];

    const initPixi = async () => {
        app = new Application();
        await app.init({
            backgroundAlpha: 0,
            resizeTo: containerRef.current!,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            eventFeatures: {
                move: true,
                globalMove: false,
                click: true,
                wheel: false,
            }
        });

        if (!containerRef.current || isDisposed) {
            // Component unmounted during init
            app.destroy(true);
            app = null;
            return; 
        }

        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        // Create world container for zoom/pan
        const world = new Container();
        world.sortableChildren = true;
        app.stage.addChild(world);
        worldRef.current = world;
        
        // Center the world initially
        world.x = app.screen.width / 2;
        world.y = app.screen.height / 2;

        // EVENTS
        // Pan logic
        let isDragging = false;
        let lastPos = { x: 0, y: 0 };

        const onMouseDown = (e: MouseEvent) => {
             // Only pan if background clicked (not a node)
             // But simpler to just allow pan everywhere for now
             if(e.button === 0) {
                 isDragging = true;
                 lastPos = { x: e.clientX, y: e.clientY };
                 const canvas = appRef.current?.canvas;
                 if (canvas?.style) {
                    canvas.style.cursor = 'grabbing';
                 }
             }
        };

        const onMouseUp = () => {
            isDragging = false;
            const canvas = appRef.current?.canvas;
            if (canvas?.style) {
                canvas.style.cursor = 'default';
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const currentWorld = worldRef.current;
            if (!currentWorld) return;
            const dx = e.clientX - lastPos.x;
            const dy = e.clientY - lastPos.y;
            currentWorld.x += dx;
            currentWorld.y += dy;
            lastPos = { x: e.clientX, y: e.clientY };
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const currentWorld = worldRef.current;
            if (!currentWorld) return;
            const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(0.1, Math.min(5, currentWorld.scale.x * scaleFactor));
            currentWorld.scale.set(newScale);
            setZoom(newScale);
        };
        
        app.canvas.addEventListener('mousedown', onMouseDown);
        cleanupListeners.push(() => app?.canvas?.removeEventListener('mousedown', onMouseDown));

        window.addEventListener('mouseup', onMouseUp);
        cleanupListeners.push(() => window.removeEventListener('mouseup', onMouseUp));

        // Use window for mousemove to handle dragging outside canvas
        window.addEventListener('mousemove', onMouseMove);
        cleanupListeners.push(() => window.removeEventListener('mousemove', onMouseMove));
        
        // Zoom logic
        app.canvas.addEventListener('wheel', onWheel, { passive: false });
        cleanupListeners.push(() => app?.canvas?.removeEventListener('wheel', onWheel));

    };

    initPixi();

    return () => {
        isDisposed = true;
        cleanupListeners.forEach((fn) => fn());
        cleanupListeners.length = 0;
        worldRef.current = null;
        if (appRef.current) {
            appRef.current.destroy(true);
            appRef.current = null;
        }
        app = null;
    };
  }, []);

  // Handle Resize
  useEffect(() => {
     const container = containerRef.current;
     if (!container) return;
     const resizeObserver = new ResizeObserver(() => {
         const app = appRef.current;
         if (!app) return;
         app.resize();
         const world = worldRef.current;
         if (world) {
             // Recenter on resize
             world.x = app.screen.width / 2;
             world.y = app.screen.height / 2;
         }
     });
     resizeObserver.observe(container);
     return () => resizeObserver.disconnect();
  }, []);


    // Render Nodes
    useEffect(() => {
        if (!worldRef.current) return;
        const nodesToRender = filteredNodes;
        const world = worldRef.current;
        world.removeChildren();

        if (!layoutNodes.length) return;

        if (!nodesToRender.length) {
            return;
        }

        // Calculate bounds from the full layout so positions stay stable when filters change
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        layoutNodes.forEach((n) => {
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x);
            minY = Math.min(minY, n.y);
            maxY = Math.max(maxY, n.y);
        });

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        const maxDim = Math.max(width, height);

        const TARGET_SPREAD = 400;
        const scale = TARGET_SPREAD / (maxDim || 1);

        nodesToRender.forEach(node => {
        // Normalize position relative to center
        const x = (node.x - (minX + width/2)) * scale;
        const y = (node.y - (minY + height/2)) * scale;

        // Determine visual properties
        // Size = items (min 10, max 60)
        const radius = Math.max(10, Math.min(60, Math.sqrt(node.artifact_count) * 6));
        
        // Color = confidence (Low/Med/High via shared focus thresholds)
        // Using heatmap colors: low=grey/blue, med=purple, high=orange/gold
        let color = 0x5e6ad2; // Default blue
        if (node.confidence > FOCUS_CONFIDENCE_HIGH_THRESHOLD) color = 0xf59e0b; // Amber
        else if (node.confidence > FOCUS_CONFIDENCE_MEDIUM_THRESHOLD) color = 0x8b5cf6; // Violet
        else color = 0x64748b; // Slate

        const g = new Graphics();
        // Fill
        g.circle(0, 0, radius);
        g.fill({ color, alpha: 0.8 });
        
        // Border = Recent Activity (Simulated for V1, backend doesn't send 'last_active' yet on TopologyNode)
        // If we had it, we'd change stroke width. defaults to 1.
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.5 });

        g.x = x;
        g.y = y;
        g.interactive = true;
        g.cursor = 'pointer';

        // Label
        if (radius > 15) { // Only label big bubbles
            const text = new Text(node.name, {
                fontFamily: 'Arial',
                fontSize: 12,
                fill: 0xffffff,
                align: 'center',
                dropShadow: {
                    color: 0x000000,
                    alpha: 0.6,
                    angle: Math.PI / 4,
                    distance: 1,
                    blur: 2
                }
            });
            text.anchor.set(0.5);
            text.y = 0; // Center text
            // Don't scale text with zoom? No, let it scale naturally for now.
            g.addChild(text);
        }

        // Interactions
        g.on('pointerenter', () => {
            g.alpha = 1;
            if (typeof node.subspace_id === 'number') {
                setHoveredNodeId(node.subspace_id);
            }
        });

        g.on('pointerleave', () => {
            g.alpha = 0.8;
            setHoveredNodeId(null);
        });

        g.on('pointertap', () => {
             onNodeClick?.(node);
        });

        world.addChild(g);
    });

    }, [layoutNodes, filteredNodes, onNodeClick]);

    const updateConfidenceRange = (index: 0 | 1, value: number) => {
        const clamped = Math.min(1, Math.max(0, value));
        setFilters((prev) => {
            const next = [...prev.confidenceRange] as [number, number];
            next[index] = clamped;
            if (index === 0 && clamped > next[1]) next[1] = clamped;
            if (index === 1 && clamped < next[0]) next[0] = clamped;
            return { ...prev, confidenceRange: next };
        });
    };

    const handleConfidenceSlider = (index: 0 | 1) => (event: ChangeEvent<HTMLInputElement>) => {
        updateConfidenceRange(index, Number(event.target.value));
    };

    const handleActivityChange = (value: string) => {
        if (!value) return;
        setFilters((prev) => ({ ...prev, activity: value as ActivityFilter }));
    };

    const handleDateChange = (value: DateRangeFilter) => {
        setFilters((prev) => ({ ...prev, dateRange: value }));
    };

    const handleResetFilters = () => {
        setFilters({ ...MAP_FILTER_DEFAULTS });
    };

    const formatConfidenceValue = (value: number) => `${Math.round(value * 100)}%`;

    const handleToggleFilters = () => setFiltersOpen((prev) => !prev);
    const timelineHasHistory = snapshots.length > 1;
    const firstSnapshot = snapshots[0];
    const latestSnapshot = snapshots[snapshots.length - 1];
    const activeSnapshot = snapshots[effectiveSnapshotIndex];

    const handleTimelineScrub = (value: number) => {
        setActiveSnapshotIndex(value);
        setIsPlaying(false);
    };

    const handlePlaybackToggle = () => {
        if (snapshots.length <= 1) return;
        setIsPlaying((prev) => !prev);
    };

    const handleZoomIn = () => {
      if(worldRef.current) {
          const newZ = Math.min(5, zoom * 1.2);
          worldRef.current.scale.set(newZ);
          setZoom(newZ);
      }
  };
  
  const handleZoomOut = () => {
      if(worldRef.current) {
          const newZ = Math.max(0.1, zoom * 0.8);
          worldRef.current.scale.set(newZ);
          setZoom(newZ);
      }
  };

  const handleReset = () => {
      const world = worldRef.current;
      const app = appRef.current;
      if (!world || !app) return;
      world.scale.set(1);
      world.x = app.screen.width / 2;
      world.y = app.screen.height / 2;
      setZoom(1);
  };

    const rootClasses = [
        'relative rounded-xl border border-white/10 overflow-hidden bg-[#0B0C0E] transition-all duration-300',
        isFullscreen ? 'fixed inset-4 z-50 h-auto' : 'h-125 w-full',
        className,
    ]
        .filter(Boolean)
        .join(' ');

  if (isLoading) return <Skeleton className="w-full h-125 rounded-xl" />;

  return (
        <div className={rootClasses}>
            <div className="absolute top-4 left-4 right-4 sm:right-auto z-30 space-y-2">
                <div className="flex items-center gap-2 sm:hidden">
                    <Button size="sm" variant="secondary" onClick={handleToggleFilters} className="gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        {filtersOpen ? 'Hide filters' : 'Filters'}
                    </Button>
                    <span className="text-xs text-white/70">
                        {visibleNodes} / {totalNodes || 0}
                    </span>
                </div>
                <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-white/80 backdrop-blur w-full sm:w-72 max-h-[70vh] overflow-y-auto`}>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/60">
                        <span>Filters</span>
                        <span>{visibleNodes} / {totalNodes || 0} topics</span>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confidence-min" className="text-xs text-white">Focus confidence</Label>
                        <div className="flex justify-between text-[11px] text-white/70 font-mono">
                            <span>{formatConfidenceValue(filters.confidenceRange[0])}</span>
                            <span>{formatConfidenceValue(filters.confidenceRange[1])}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <input
                                id="confidence-min"
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={filters.confidenceRange[0]}
                                onChange={handleConfidenceSlider(0)}
                                className="w-full accent-[#5E6AD2]"
                            />
                            <input
                                id="confidence-max"
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={filters.confidenceRange[1]}
                                onChange={handleConfidenceSlider(1)}
                                className="w-full accent-[#5E6AD2]"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs text-white">Activity level</Label>
                        <ToggleGroup
                            type="single"
                            size="sm"
                            variant="outline"
                            value={filters.activity}
                            onValueChange={handleActivityChange}
                            className="w-full"
                        >
                            <ToggleGroupItem value="all" className="flex-1 justify-center text-xs">All</ToggleGroupItem>
                            <ToggleGroupItem value="high" className="flex-1 justify-center text-xs">High</ToggleGroupItem>
                            <ToggleGroupItem value="medium" className="flex-1 justify-center text-xs">Med</ToggleGroupItem>
                            <ToggleGroupItem value="low" className="flex-1 justify-center text-xs">Low</ToggleGroupItem>
                        </ToggleGroup>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs text-white">Date range</Label>
                        <Select value={filters.dateRange} onValueChange={(value) => handleDateChange(value as DateRangeFilter)}>
                            <SelectTrigger className="w-full h-9 border-white/10 bg-white/5 text-xs text-white">
                                <SelectValue placeholder="All time" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0B0C0E]/95 border border-white/10 text-white">
                                <SelectItem value="all">All time</SelectItem>
                                <SelectItem value="7d">Last 7 days</SelectItem>
                                <SelectItem value="30d">Last 30 days</SelectItem>
                                <SelectItem value="90d">Last 90 days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        className="justify-center text-xs"
                        onClick={handleResetFilters}
                        disabled={!filtersActive}
                    >
                        Reset filters
                    </Button>
                </div>
            </div>
        <div ref={containerRef} className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white/5 to-transparent" />
        
        {/* Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
            <Button variant="secondary" size="icon" onClick={handleReset} title="Reset">
                <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={handleZoomIn} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={handleZoomOut} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
        </div>

        {/* Tooltip Overlay */}
        {hoveredNode && (
             <div 
                className="absolute pointer-events-none bg-black/90 border border-white/10 p-3 rounded-lg shadow-xl text-xs z-10 w-48"
                style={{ 
                    top: 20, // specific layout
                    left: 20
                    // Or follow mouse: but React state lag can make it jagged. 
                    // Better to just have a fixed info panel or positioning.
                    // For now, let's put it top-left fixed.
                }}
             >
                <div className="font-bold text-white mb-1 text-sm">{hoveredNode.name}</div>
                <div className="flex justify-between text-gray-400">
                    <span>Items:</span>
                    <span className="text-white">{hoveredNode.artifact_count} item{hoveredNode.artifact_count === 1 ? '' : 's'}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span>Focus:</span>
                    <span
                        style={{
                            color:
                                hoveredNode.confidence > FOCUS_CONFIDENCE_HIGH_THRESHOLD
                                    ? '#f59e0b'
                                    : '#8b5cf6',
                        }}
                    >
                        {Math.round(hoveredNode.confidence * 100)}%
                    </span>
                </div>
             </div>
        )}

        {snapshots.length > 0 ? (
            <div className="absolute bottom-4 left-1/2 z-30 w-[min(720px,calc(100%-2rem))] -translate-x-1/2">
                <div className="rounded-2xl border border-white/10 bg-black/80 px-4 py-3 text-white backdrop-blur">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={handlePlaybackToggle}
                                disabled={!timelineHasHistory}
                                title={timelineHasHistory ? (isTimelinePlaying ? 'Pause playback' : 'Play timeline') : 'More snapshots needed'}
                            >
                                {isTimelinePlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <div>
                                <p className="flex items-center gap-1 text-xs font-medium text-white">
                                    <CalendarClock className="h-3.5 w-3.5 text-white/70" />
                                    {formatSnapshotTimestamp(activeSnapshot?.timestamp ?? topology?.metadata?.last_updated)}
                                </p>
                                <p className="text-[10px] uppercase tracking-wide text-white/50">
                                    Snapshot {snapshots.length ? effectiveSnapshotIndex + 1 : 0}/{snapshots.length || 1}
                                </p>
                            </div>
                        </div>
                        <div className="flex-1">
                            <input
                                type="range"
                                min={0}
                                max={Math.max(0, snapshots.length - 1)}
                                value={snapshots.length ? effectiveSnapshotIndex : 0}
                                onChange={(event) => handleTimelineScrub(Number(event.target.value))}
                                disabled={snapshots.length <= 1}
                                className="w-full accent-[#5E6AD2]"
                            />
                            <div className="mt-1 flex justify-between text-[10px] font-mono uppercase text-white/40">
                                <span>{formatSnapshotTimestamp(firstSnapshot?.timestamp)}</span>
                                <span>{formatSnapshotTimestamp(latestSnapshot?.timestamp)}</span>
                            </div>
                        </div>
                        <div className="text-right text-[11px] text-white/70">
                            {timelineHasHistory ? `${snapshots.length} captures` : 'Single capture'}
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-30">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs text-white/70 backdrop-blur">
                    <CalendarClock className="h-3.5 w-3.5 text-white/60" />
                    Historical playback becomes available after the next ingestion cycle.
                </div>
            </div>
        )}
        
        {totalNodes > 0 && visibleNodes === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                No topics match the current filters.
            </div>
        )}

        {totalNodes === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                No topology data available yet.
            </div>
        )}
    </div>
  );
}

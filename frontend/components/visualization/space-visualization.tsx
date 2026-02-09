'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Artifact, EngagementLevel } from '@/types/api';

// ============================================================================
// Engagement Colors - Matching brand #1e90ff
// ============================================================================
const ENGAGEMENT_COLORS: Record<EngagementLevel, number> = {
    ambient: 0x3a3a4f,     // Muted gray-purple
    engaged: 0x1e90ff,     // Brand blue
    committed: 0xffa500,   // Warm amber
};

const ENGAGEMENT_NAMES: Record<EngagementLevel, string> = {
    ambient: 'Ambient',
    engaged: 'Engaged',
    committed: 'Committed',
};

// ============================================================================
// Types
// ============================================================================
interface ArtifactNode {
    id: number;
    title: string;
    x: number;
    y: number;
    engagement: EngagementLevel;
    graphics?: Graphics;
}

interface SpaceVisualizationProps {
    artifacts: Artifact[];
    onArtifactClick?: (artifact: Artifact) => void;
    onArtifactHover?: (artifact: Artifact | null) => void;
    selectedArtifactId?: number;
}

// ============================================================================
// Math Helpers
// ============================================================================
function drawOrganicBlob(
    centerX: number,
    centerY: number,
    radius: number,
    numPoints: number,
    time: number
): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const wobble = Math.sin(time * 0.5 + theta * 3) * 4 +
            Math.sin(time * 0.3 + theta * 5) * 3;
        const r = radius + wobble;

        points.push({
            x: centerX + Math.cos(theta) * r,
            y: centerY + Math.sin(theta) * r,
        });
    }

    return points;
}

function drawSmoothBlob(
    graphics: Graphics,
    points: { x: number; y: number }[],
    color: number,
    alpha: number
) {
    if (points.length < 3) return;

    graphics.beginFill(color, alpha);

    // Move to first point
    graphics.moveTo(points[0].x, points[0].y);

    // Draw smooth bezier curves through points
    for (let i = 0; i < points.length; i++) {
        const p0 = points[(i - 1 + points.length) % points.length];
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const p3 = points[(i + 2) % points.length];

        // Catmull-Rom to Bezier conversion
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        graphics.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    graphics.endFill();
}

// ============================================================================
// Main Component
// ============================================================================
export function SpaceVisualization({
    artifacts,
    onArtifactClick,
    onArtifactHover,
    selectedArtifactId,
}: SpaceVisualizationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const worldRef = useRef<Container | null>(null);
    const animationRef = useRef<number | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [hoveredArtifact, setHoveredArtifact] = useState<Artifact | null>(null);
    const [zoom, setZoom] = useState(1);

    // Drag state
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!containerRef.current || artifacts.length === 0) return;

        const container = containerRef.current;
        let isDestroyed = false;

        async function initPixi() {
            const app = new Application();

            await app.init({
                width: container.clientWidth,
                height: container.clientHeight,
                backgroundColor: 0x0a0a0f,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            if (isDestroyed) {
                app.destroy(true);
                return;
            }

            container.appendChild(app.canvas);
            appRef.current = app;

            const world = new Container();
            world.eventMode = 'static';
            app.stage.addChild(world);
            worldRef.current = world;

            const width = app.screen.width;
            const height = app.screen.height;
            const centerX = width / 2;
            const centerY = height / 2;

            // Group artifacts by engagement level
            const artifactsByLevel: Record<EngagementLevel, Artifact[]> = {
                ambient: [],
                engaged: [],
                committed: [],
            };
            artifacts.forEach(a => {
                const level = a.engagement_level || 'ambient';
                artifactsByLevel[level].push(a);
            });

            // Base radius for blobs
            const minDim = Math.min(width, height);
            const baseRadius = minDim * 0.35;

            // Create starfield
            const starContainer = new Container();
            world.addChild(starContainer);
            for (let i = 0; i < 100; i++) {
                const star = new Graphics();
                const r = Math.random() * 1.5;
                const alpha = Math.random() * 0.4 + 0.1;
                star.circle(0, 0, r);
                star.fill({ color: 0xffffff, alpha });
                star.x = (Math.random() - 0.5) * width * 2;
                star.y = (Math.random() - 0.5) * height * 2;
                starContainer.addChild(star);
            }

            // Create blob container with blur
            const blobContainer = new Container();
            const glowFilter = new BlurFilter({ strength: 15, quality: 2 });
            blobContainer.filters = [glowFilter];
            world.addChild(blobContainer);

            // Create blobs for each engagement level
            const activeBlobs: { graphics: Graphics; level: EngagementLevel }[] = [];
            const levels: EngagementLevel[] = ['ambient', 'engaged', 'committed'];

            levels.forEach(level => {
                if (artifactsByLevel[level].length > 0) {
                    const g = new Graphics();
                    g.blendMode = 'add';
                    blobContainer.addChild(g);
                    activeBlobs.push({ graphics: g, level });
                }
            });

            // Create node container
            const nodeContainer = new Container();
            world.addChild(nodeContainer);

            // Calculate blob radius based on artifact count
            const calculateRadius = (count: number): number => {
                if (count === 0) return 0;
                return baseRadius * Math.max(0.2, Math.sqrt(count / artifacts.length));
            };

            // Position artifacts in a golden spiral
            const nodeData: ArtifactNode[] = [];
            let globalIndex = 0;

            levels.forEach(level => {
                const levelArtifacts = artifactsByLevel[level];
                const count = levelArtifacts.length;
                if (count === 0) return;

                levelArtifacts.forEach((artifact, idx) => {
                    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
                    const angle = globalIndex * goldenAngle;
                    const normalizedIdx = globalIndex / Math.max(artifacts.length - 1, 1);
                    const distance = baseRadius * 0.1 + baseRadius * 0.8 * Math.sqrt(normalizedIdx);

                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;

                    // Create node
                    const circle = new Graphics();
                    const isSelected = artifact.id === selectedArtifactId;
                    const nodeSize = isSelected ? 8 : 5;

                    circle.circle(0, 0, nodeSize);
                    if (isSelected) {
                        circle.stroke({ color: 0xffd700, width: 2 });
                    }
                    circle.fill({ color: ENGAGEMENT_COLORS[level] });

                    circle.x = x;
                    circle.y = y;
                    circle.eventMode = 'static';
                    circle.cursor = 'pointer';

                    circle.on('pointerenter', () => {
                        if (!isSelected) circle.scale.set(1.5);
                        setHoveredArtifact(artifact);
                        onArtifactHover?.(artifact);
                    });

                    circle.on('pointerleave', () => {
                        if (!isSelected) circle.scale.set(1);
                        setHoveredArtifact(null);
                        onArtifactHover?.(null);
                    });

                    circle.on('pointertap', () => {
                        onArtifactClick?.(artifact);
                    });

                    nodeContainer.addChild(circle);
                    nodeData.push({
                        id: artifact.id,
                        title: artifact.title || artifact.url,
                        x,
                        y,
                        engagement: level,
                        graphics: circle,
                    });

                    globalIndex++;
                });
            });

            // Zoom handlers
            app.canvas.addEventListener('wheel', (e: WheelEvent) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = Math.max(0.5, Math.min(3, world.scale.x * delta));
                world.scale.set(newZoom);
                setZoom(newZoom);
            }, { passive: false });

            app.canvas.addEventListener('mousedown', (e: MouseEvent) => {
                if (e.button === 0) {
                    isDragging.current = true;
                    lastPos.current = { x: e.clientX, y: e.clientY };
                }
            });

            app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
                if (isDragging.current) {
                    const dx = e.clientX - lastPos.current.x;
                    const dy = e.clientY - lastPos.current.y;
                    world.x += dx;
                    world.y += dy;
                    lastPos.current = { x: e.clientX, y: e.clientY };
                }
            });

            app.canvas.addEventListener('mouseup', () => {
                isDragging.current = false;
            });

            app.canvas.addEventListener('mouseleave', () => {
                isDragging.current = false;
            });

            // Animation loop
            let time = 0;

            const animate = () => {
                if (isDestroyed) return;
                time += 0.016;

                // Draw blobs
                activeBlobs.forEach(({ graphics, level }) => {
                    const count = artifactsByLevel[level].length;
                    const blobRadius = calculateRadius(count);

                    const driftSpeed = 0.2;
                    const driftRadius = 15;
                    const phaseOffset = levels.indexOf(level) * (Math.PI / 2);
                    const offsetX = Math.sin(time * driftSpeed + phaseOffset) * driftRadius;
                    const offsetY = Math.cos(time * driftSpeed * 0.7 + phaseOffset) * driftRadius;

                    const points = drawOrganicBlob(
                        centerX + offsetX,
                        centerY + offsetY,
                        blobRadius,
                        24,
                        time + levels.indexOf(level) * 0.5
                    );

                    graphics.clear();
                    drawSmoothBlob(graphics, points, ENGAGEMENT_COLORS[level], 0.35);
                });

                // Animate stars
                starContainer.rotation += 0.0002;

                // Gentle node floating
                nodeData.forEach((node, idx) => {
                    if (!node.graphics) return;
                    const phase = idx * 0.7;
                    const floatX = Math.sin(time * 0.8 + phase) * 2;
                    const floatY = Math.cos(time * 0.6 + phase * 1.3) * 2;
                    node.graphics.x = node.x + floatX;
                    node.graphics.y = node.y + floatY;
                });

                animationRef.current = requestAnimationFrame(animate);
            };

            animate();
            setIsReady(true);
        }

        initPixi();

        return () => {
            isDestroyed = true;
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
            }
        };
    }, [artifacts, selectedArtifactId, onArtifactClick, onArtifactHover]);

    const handleReset = useCallback(() => {
        if (worldRef.current) {
            worldRef.current.scale.set(1);
            worldRef.current.x = 0;
            worldRef.current.y = 0;
            setZoom(1);
        }
    }, []);

    const handleZoomIn = useCallback(() => {
        if (worldRef.current) {
            const newZoom = Math.min(3, zoom * 1.3);
            worldRef.current.scale.set(newZoom);
            setZoom(newZoom);
        }
    }, [zoom]);

    const handleZoomOut = useCallback(() => {
        if (worldRef.current) {
            const newZoom = Math.max(0.5, zoom * 0.7);
            worldRef.current.scale.set(newZoom);
            setZoom(newZoom);
        }
    }, [zoom]);

    if (artifacts.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">No artifacts to visualize</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-border">
            <div
                ref={containerRef}
                className="w-full h-full"
                style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
            />

            {/* Controls */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm border border-border/50"
                >
                    <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm border border-border/50"
                >
                    <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-7 px-2 text-xs gap-1 bg-background/80 backdrop-blur-sm border border-border/50"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                </Button>
                <span className="text-xs text-muted-foreground/60 font-mono ml-1">
                    {Math.round(zoom * 100)}%
                </span>
            </div>

            {/* Legend */}
            <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                    Engagement
                </div>
                {(['deep', 'focused', 'active', 'latent'] as EngagementLevel[]).map(level => (
                    <div key={level} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: `#${ENGAGEMENT_COLORS[level].toString(16).padStart(6, '0')}` }}
                        />
                        <span className="text-[10px] text-muted-foreground">{ENGAGEMENT_NAMES[level]}</span>
                    </div>
                ))}
            </div>

            {/* Hover tooltip */}
            {hoveredArtifact && (
                <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm border border-border/50 rounded-lg p-2.5 max-w-xs">
                    <div className="text-xs font-medium text-foreground line-clamp-2">
                        {hoveredArtifact.title || hoveredArtifact.url}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                        <span className="capitalize">{hoveredArtifact.engagement_level}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{hoveredArtifact.domain}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

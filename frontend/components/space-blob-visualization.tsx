'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

// Local copies of the old types/constants so the file is self-contained.
type StateIndex = 0 | 1 | 2 | 3;
type StateVector = [number, number, number, number];

type Subspace = {
  id: string;
  name: string;
  markers?: string[];
  evidence?: number;
  displayOrder?: number;
};

type Space = {
  id: string | number;
  name: string;
  subspaces?: Subspace[];
  stateVector?: StateVector;
};

const STATE_THRESHOLDS = {
  THETA_1: 1,
  THETA_2: 3,
  THETA_3: 6,
} as const;

const TOTAL_MASS = 100;

// ============================================================================
// State Colors - Map to state indices [0,1,2,3]
// ============================================================================
const STATE_COLORS: Record<StateIndex, number> = {
  0: 0x2e266f, // Latent - Deep Electric Indigo (Foundation)
  1: 0x7c4dff, // Discovered - Neon Purple (Active)
  2: 0x00e5ff, // Engaged - Cyan/Electric Blue (Focus)
  3: 0xffffff, // Saturated - Pure White/Core (Intensity)
};

const STATE_NAMES: Record<StateIndex, string> = {
  0: 'Latent',
  1: 'Discovered',
  2: 'Engaged',
  3: 'Saturated',
};

// ============================================================================
// Types
// ============================================================================
interface SubspaceNode {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number; // Target position for animation
  targetY: number;
  stateIndex: StateIndex;
  previousState: StateIndex | null; // Track previous state for animation
  markers: string[];
  graphics?: Graphics;
  isAnimating: boolean; // Currently transitioning between states
  animationProgress: number; // 0-1 progress of state transition
}

interface SpaceBlobVisualizationProps {
  space: Space;
  massVector?: StateVector; // Optional override for mass vector (for dynamic updates)
  onSubspaceClick?: (subspace: Subspace) => void;
  onSubspaceHover?: (subspace: Subspace | null) => void;
  onSubspaceDoubleClick?: (subspace: Subspace) => void;
  selectedSubspaceId?: string;
  animateTransitions?: boolean; // Enable dot movement animation (default: true)
}

// ============================================================================
// Animation Constants
// ============================================================================
const TRANSITION_DURATION_MS = 800; // Duration of dot state transition animation

// ============================================================================
// Math -> Visual Mapping (from documentation)
// ============================================================================

/**
 * Get state index from evidence (matching engine logic)
 */
function getStateFromEvidence(evidence: number): StateIndex {
  if (evidence >= STATE_THRESHOLDS.THETA_3) return 3;
  if (evidence >= STATE_THRESHOLDS.THETA_2) return 2;
  if (evidence >= STATE_THRESHOLDS.THETA_1) return 1;
  return 0;
}

/**
 * Calculate blob radius from mass (mass-proportional sizing)
 * Uses sqrt scaling so area is proportional to mass
 */
function calculateBlobRadius(mass: number, totalMass: number, baseRadius: number): number {
  if (totalMass === 0 || mass === 0) return baseRadius * 0.5;
  const proportion = mass / totalMass;
  // sqrt scaling so area is proportional to mass
  return baseRadius * Math.sqrt(proportion) * 2;
}

/**
 * Simple organic blob shape with wobble animation
 */
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

    // Organic wobble
    const wobble = Math.sin(time * 0.5 + theta * 3) * 4 + Math.sin(time * 0.3 + theta * 5) * 3;
    const r = radius + wobble;

    points.push({
      x: centerX + Math.cos(theta) * r,
      y: centerY + Math.sin(theta) * r,
    });
  }

  return points;
}

// ============================================================================
// Main Component (copied from legacy Misir frontend)
// ============================================================================
export function SpaceBlobVisualization({
  space,
  massVector: massVectorProp,
  onSubspaceClick,
  onSubspaceHover,
  onSubspaceDoubleClick,
  selectedSubspaceId,
  animateTransitions = true,
}: SpaceBlobVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const animationRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hoveredSubspace, setHoveredSubspace] = useState<Subspace | null>(null);
  const [zoom, setZoom] = useState(1);
  const [, setPan] = useState({ x: 0, y: 0 }); // Pan state for world position
  const [resizeKey, setResizeKey] = useState(0); // Force re-render on resize

  // Track previous states for animation
  const previousStatesRef = useRef<Map<string, StateIndex>>(new Map());

  // Track node data for animation access
  const nodeDataRef = useRef<SubspaceNode[]>([]);

  // Drag state for panning
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Use prop massVector if provided, otherwise fall back to space.stateVector
  const effectiveMassVector = useMemo(() => {
    return massVectorProp || space.stateVector || [TOTAL_MASS, 0, 0, 0];
  }, [massVectorProp, space.stateVector]);

  // Stable string keys for dependency array to avoid array size changes
  const massVectorKey = effectiveMassVector.join(',');
  const subspacesKey = useMemo(
    () => (space.subspaces || []).map((s) => `${s.id}:${s.evidence}`).join('|'),
    [space.subspaces]
  );

  // Debounced resize handler for full re-render
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setResizeKey((k) => k + 1);
      }, 250); // Debounce 250ms
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let isDestroyed = false;
    const blobGraphics: Graphics[] = [];

    async function initPixi() {
      const app = new Application();

      await app.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: 0x0a0a0a,
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

      // Create world container for zoom/pan
      const world = new Container();
      world.eventMode = 'static';
      app.stage.addChild(world);
      worldRef.current = world;

      const width = app.screen.width;
      const height = app.screen.height;
      const centerX = width / 2;
      const centerY = height / 2;

      const subspaces = space.subspaces || [];

      // Base blob radius - 40% of smallest dimension
      const minDim = Math.min(width, height);
      const baseRadius = minDim * 0.4;

      // First, group subspaces by their state based on evidence
      const subspacesByState: Record<StateIndex, typeof subspaces> = { 0: [], 1: [], 2: [], 3: [] };
      subspaces.forEach((subspace) => {
        const state = getStateFromEvidence(subspace.evidence || 0);
        subspacesByState[state].push(subspace);
      });

      // Calculate blob radii based on SUBSPACE COUNT (not mass)
      // This ensures blobs only encompass their own subspaces
      const totalSubspaceCount = subspaces.length || 1;
      const blobRadii: Record<StateIndex, number> = {
        0: calculateBlobRadius(subspacesByState[0].length, totalSubspaceCount, baseRadius),
        1: calculateBlobRadius(subspacesByState[1].length, totalSubspaceCount, baseRadius),
        2: calculateBlobRadius(subspacesByState[2].length, totalSubspaceCount, baseRadius),
        3: calculateBlobRadius(subspacesByState[3].length, totalSubspaceCount, baseRadius),
      };

      // Create background starfield
      const starContainer = new Container();
      world.addChild(starContainer);
      const STARS = 200;
      for (let i = 0; i < STARS; i++) {
        const star = new Graphics();
        const r = Math.random() * 1.5;
        const alpha = Math.random() * 0.5 + 0.1;
        star.circle(0, 0, r);
        star.fill({ color: 0xffffff, alpha });
        star.x = (Math.random() - 0.5) * width * 3; // Wider field for panning
        star.y = (Math.random() - 0.5) * height * 3;
        starContainer.addChild(star);
      }

      // Create blob container (behind nodes)
      const blobContainer = new Container();
      // Add heavy blur for "glow" effect
      const glowFilter = new BlurFilter({ strength: 20, quality: 3 });
      blobContainer.filters = [glowFilter];
      world.addChild(blobContainer);

      // Create blobs for each state using mass vector for glow sizing
      const massVector: StateVector = effectiveMassVector;
      const totalMass = massVector.reduce((a, b) => a + b, 0) || TOTAL_MASS;
      const blobPositions: Record<StateIndex, { x: number; y: number; radius: number }> = {
        3: { x: centerX, y: centerY, radius: blobRadii[3] }, // Saturated - center
        2: { x: centerX, y: centerY - blobRadii[3] - blobRadii[2] * 0.5, radius: blobRadii[2] }, // Engaged - above
        1: { x: centerX - blobRadii[2] - blobRadii[1] * 0.5, y: centerY, radius: blobRadii[1] }, // Discovered - left
        0: { x: centerX + blobRadii[1] + blobRadii[0] * 0.5, y: centerY, radius: blobRadii[0] }, // Latent - right
      };

      // Draw blobs
      (Object.keys(blobPositions) as unknown as StateIndex[]).forEach((state) => {
        const { x, y, radius } = blobPositions[state];
        const points = drawOrganicBlob(x, y, radius, 16, 0);
        const g = new Graphics();
        const alpha = Math.max(0.15, massVector[state] / Math.max(totalMass, 1) * 0.8);
        g.beginFill(STATE_COLORS[state], alpha);
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const cpX = (p0.x + p1.x) / 2;
          const cpY = (p0.y + p1.y) / 2;
          g.quadraticCurveTo(p0.x, p0.y, cpX, cpY);
        }
        g.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y);
        g.endFill();
        g.filters = [glowFilter];
        blobContainer.addChild(g);
        blobGraphics.push(g);
      });

      // Create nodes for subspaces
      const nodeContainer = new Container();
      world.addChild(nodeContainer);

      nodeDataRef.current = subspaces.map((subspace, index) => {
        const state = getStateFromEvidence(subspace.evidence || 0);
        const stateSubspaces = subspacesByState[state];
        const stateIndex = stateSubspaces.findIndex((s) => s.id === subspace.id);
        const angle = (stateIndex / Math.max(stateSubspaces.length, 1)) * Math.PI * 2;
        const radius = blobPositions[state].radius * 0.6;
        const x = blobPositions[state].x + Math.cos(angle) * radius;
        const y = blobPositions[state].y + Math.sin(angle) * radius;

        return {
          id: subspace.id,
          name: subspace.name,
          x,
          y,
          targetX: x,
          targetY: y,
          stateIndex: state,
          previousState: state,
          markers: subspace.markers || [],
          graphics: undefined,
          isAnimating: false,
          animationProgress: 0,
        } satisfies SubspaceNode;
      });

      // Add dots to container
      nodeDataRef.current.forEach((node) => {
        const circle = new Graphics();
        circle.circle(0, 0, 8);
        circle.fill({ color: STATE_COLORS[node.stateIndex] });
        circle.x = node.x;
        circle.y = node.y;
        circle.eventMode = 'static';
        circle.cursor = 'pointer';

        circle.on('pointerenter', () => {
          circle.scale.set(1.3);
          const subspace = subspaces.find((s) => s.id === node.id) || null;
          setHoveredSubspace(subspace);
          onSubspaceHover?.(subspace);
        });

        circle.on('pointerleave', () => {
          circle.scale.set(1);
          setHoveredSubspace(null);
          onSubspaceHover?.(null);
        });

        circle.on('pointertap', () => {
          const subspace = subspaces.find((s) => s.id === node.id);
          if (subspace) onSubspaceClick?.(subspace);
        });

        circle.on('pointerup', (event: any) => {
          if (event.detail === 2) {
            const subspace = subspaces.find((s) => s.id === node.id);
            if (subspace) onSubspaceDoubleClick?.(subspace);
          }
        });

        node.graphics = circle;
        nodeContainer.addChild(circle);
      });

      // Drag to pan
      app.canvas.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button === 0) {
          isDragging.current = true;
          lastPos.current = { x: e.clientX, y: e.clientY };
        }
      });

      app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
        if (isDragging.current && worldRef.current) {
          const dx = e.clientX - lastPos.current.x;
          const dy = e.clientY - lastPos.current.y;
          worldRef.current.x += dx;
          worldRef.current.y += dy;
          lastPos.current = { x: e.clientX, y: e.clientY };
          setPan({ x: worldRef.current.x, y: worldRef.current.y });
        }
      });

      const stopDragging = () => {
        isDragging.current = false;
      };

      app.canvas.addEventListener('mouseup', stopDragging);
      app.canvas.addEventListener('mouseleave', stopDragging);

      // Scroll to zoom
      app.canvas.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          const newZoom = Math.max(0.5, Math.min(3, world.scale.x * delta));
          world.scale.set(newZoom);
          setZoom(newZoom);
        },
        { passive: false }
      );

      // Animation loop
      let time = 0;
      const animate = () => {
        if (isDestroyed) return;
        time += 0.016;

        // Animate blobs
        blobGraphics.forEach((g, idx) => {
          const state = idx as StateIndex;
          const radius = blobPositions[state].radius;
          const points = drawOrganicBlob(
            blobPositions[state].x,
            blobPositions[state].y,
            radius,
            16,
            time + idx * 0.3
          );
          g.clear();
          g.beginFill(STATE_COLORS[state], 0.15 + 0.1 * Math.sin(time * 0.5 + idx));
          g.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const cpX = (p0.x + p1.x) / 2;
            const cpY = (p0.y + p1.y) / 2;
            g.quadraticCurveTo(p0.x, p0.y, cpX, cpY);
          }
          g.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y);
          g.endFill();
        });

        // Animate node floating
        nodeDataRef.current.forEach((node, idx) => {
          if (!node.graphics) return;
          const phase = idx * 0.5;
          const floatX = Math.sin(time * 0.8 + phase) * 1.5;
          const floatY = Math.cos(time * 0.7 + phase * 1.2) * 1.5;

          // Smoothly interpolate toward target positions (for state transitions)
          if (node.isAnimating) {
            node.animationProgress = Math.min(1, node.animationProgress + 0.016 * (1000 / TRANSITION_DURATION_MS));
            const t = easeOutCubic(node.animationProgress);
            const newX = lerp(node.x, node.targetX, t);
            const newY = lerp(node.y, node.targetY, t);
            node.graphics.x = newX + floatX;
            node.graphics.y = newY + floatY;
            if (node.animationProgress >= 1) {
              node.isAnimating = false;
              node.x = node.targetX;
              node.y = node.targetY;
            }
          } else {
            node.graphics.x = node.targetX + floatX;
            node.graphics.y = node.targetY + floatY;
          }
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
  }, [space.subspaces, effectiveMassVector, massVectorKey, subspacesKey, animateTransitions]);

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

  // Highlight selected subspace
  useEffect(() => {
    nodeDataRef.current.forEach((node) => {
      if (!node.graphics) return;
      const isSelected = node.id === selectedSubspaceId;
      node.graphics.clear();
      node.graphics.circle(0, 0, isSelected ? 10 : 8);
      node.graphics.stroke({ color: isSelected ? 0xffd700 : 0x000000, width: isSelected ? 2 : 0 });
      node.graphics.fill({ color: STATE_COLORS[node.stateIndex] });
    });
  }, [selectedSubspaceId]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-border bg-background/80">
      <div key={resizeKey} ref={containerRef} className="absolute inset-0" />

      {/* Controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-2 rounded-lg bg-background/80 p-2 shadow-sm">
        <Button variant="ghost" size="icon" onClick={handleReset} title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute left-3 top-3 rounded-lg bg-background/80 p-3 shadow-sm">
        <div className="text-xs font-medium text-muted-foreground mb-2">Engagement States</div>
        <div className="space-y-1 text-xs">
          {(Object.keys(STATE_NAMES) as unknown as StateIndex[]).map((state) => (
            <div key={state} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `#${STATE_COLORS[state].toString(16).padStart(6, '0')}` }}
              />
              <span>{STATE_NAMES[state]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredSubspace && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md bg-background/90 px-3 py-1 text-xs shadow-sm">
          <div className="font-medium">{hoveredSubspace.name}</div>
          <div className="text-muted-foreground">Markers: {(hoveredSubspace.markers || []).slice(0, 3).join(', ') || 'None'}</div>
        </div>
      )}

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Initializing visualization…
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions (kept local for self-containment)
// ============================================================================
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Graphics, Container, BlurFilter } from 'pixi.js';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Space, Subspace, StateVector, StateIndex } from '@/lib/types';
import { STATE_THRESHOLDS, TOTAL_MASS } from '@/lib/math';

// ============================================================================
// State Colors - Map to state indices [0,1,2,3]
// ============================================================================
const STATE_COLORS: Record<StateIndex, number> = {
  0: 0x2E266F,  // Latent - Deep Electric Indigo (Foundation)
  1: 0x7C4DFF,  // Discovered - Neon Purple (Active)
  2: 0x00E5FF,  // Engaged - Cyan/Electric Blue (Focus)
  3: 0xFFFFFF,  // Saturated - Pure White/Core (Intensity)
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
  targetX: number;  // Target position for animation
  targetY: number;
  stateIndex: StateIndex;
  previousState: StateIndex | null;  // Track previous state for animation
  markers: string[];
  graphics?: Graphics;
  isAnimating: boolean;  // Currently transitioning between states
  animationProgress: number;  // 0-1 progress of state transition
}

interface SpaceBlobVisualizationProps {
  space: Space;
  massVector?: StateVector;  // Optional override for mass vector (for dynamic updates)
  onSubspaceClick?: (subspace: Subspace) => void;
  onSubspaceHover?: (subspace: Subspace | null) => void;
  onSubspaceDoubleClick?: (subspace: Subspace) => void;
  selectedSubspaceId?: string;
  animateTransitions?: boolean;  // Enable dot movement animation (default: true)
}

// ============================================================================
// Animation Constants
// ============================================================================
const TRANSITION_DURATION_MS = 800;  // Duration of dot state transition animation

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
  if (totalMass === 0 || mass === 0) return 0;
  const massRatio = mass / totalMass;
  // Use sqrt so area is proportional to mass (not radius)
  // Min 20% radius even for small mass to keep visible
  return baseRadius * Math.max(0.2, Math.sqrt(massRatio));
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

// ============================================================================
// Main Component
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
  const subspacesKey = useMemo(() =>
    (space.subspaces || []).map(s => `${s.id}:${s.evidence}`).join('|'),
    [space.subspaces]
  );

  // Debounced resize handler for full re-render
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        setResizeKey(k => k + 1);
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
      const subspacesByState: Record<StateIndex, typeof subspaces> = {
        0: [], 1: [], 2: [], 3: []
      };
      subspaces.forEach(subspace => {
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

      // Track which states have subspaces for rendering
      // Use subspace count (not mass) to determine active states
      const activeStates: StateIndex[] = [];
      for (let i = 0; i < 4; i++) {
        if (subspacesByState[i as StateIndex].length > 0) {
          activeStates.push(i as StateIndex);
        }
      }
      // Sort so Latent (largest) renders first, then smaller blobs on top
      activeStates.sort((a, b) => a - b);

      console.log('[Viz] Subspaces by state:', {
        latent: subspacesByState[0].length,
        discovered: subspacesByState[1].length,
        engaged: subspacesByState[2].length,
        saturated: subspacesByState[3].length,
      });
      console.log('[Viz] Active states:', activeStates, 'Blob radii:', blobRadii);

      const hasMultipleStates = activeStates.length > 1;

      // Create state blobs only for states with subspaces
      const stateBlobs: { graphics: Graphics; stateIndex: StateIndex }[] = [];
      activeStates.forEach((stateIdx) => {
        const g = new Graphics();
        // Use ADD blending for light mixing effect
        g.blendMode = 'add';
        blobContainer.addChild(g);
        stateBlobs.push({ graphics: g, stateIndex: stateIdx });
        blobGraphics.push(g);
      });

      // Create connection lines container (behind nodes, in front of blobs)
      const connectionContainer = new Container();
      // connectionContainer.blendMode = 'add'; // Optional: make connections glow
      world.addChild(connectionContainer);

      // Create node container
      const nodeContainer = new Container();
      world.addChild(nodeContainer);

      // "Weather Map" Layout: Center everything, but allow slight drift
      const getBlobCenter = (stateIdx: StateIndex): { x: number; y: number } => {
        // Everything centered at (centerX, centerY)
        // We'll add dynamic drift in the animation loop instead of static offsets
        return { x: centerX, y: centerY };
      };

      // Performance: determine node size based on subspace count
      const totalSubspaces = subspaces.length;
      const nodeBaseSize = totalSubspaces > 100 ? 3 : (totalSubspaces > 50 ? 4 : 6);
      const nodeSelectedSize = totalSubspaces > 100 ? 5 : (totalSubspaces > 50 ? 6 : 10);

      // Helper to calculate node position within a state blob
      const calculateNodePosition = (
        stateIdx: StateIndex,
        indexInState: number,
        totalInState: number
      ): { x: number; y: number } => {
        const blobCenter = getBlobCenter(stateIdx);
        const blobRadius = blobRadii[stateIdx];
        const nodeRadius = blobRadius * 0.85;  // 85% of blob for node placement

        // Golden angle spiral within this state's blob
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = indexInState * goldenAngle;
        const normalizedIdx = indexInState / Math.max(totalInState - 1, 1);
        const distance = nodeRadius * 0.1 + nodeRadius * 0.9 * Math.sqrt(normalizedIdx);

        return {
          x: blobCenter.x + Math.cos(angle) * distance,
          y: blobCenter.y + Math.sin(angle) * distance,
        };
      };

      // Create subspace nodes - positioned inside their state's blob
      const nodeData: SubspaceNode[] = [];

      activeStates.forEach(stateIdx => {
        const stateSubspaces = subspacesByState[stateIdx];

        stateSubspaces.forEach((subspace, idx) => {
          const position = calculateNodePosition(stateIdx, idx, stateSubspaces.length);

          // Check if this subspace changed state (for animation)
          const previousState = previousStatesRef.current.get(subspace.id);
          const stateChanged = previousState !== undefined && previousState !== stateIdx;

          // Calculate starting position if animating from previous state
          let startX = position.x;
          let startY = position.y;

          if (animateTransitions && stateChanged && previousState !== null) {
            // Start from previous blob position
            const prevSubspacesInState = subspacesByState[previousState];
            const prevIdx = prevSubspacesInState.findIndex(s => s.id === subspace.id);
            if (prevIdx === -1) {
              // Wasn't in previous state group, use previous blob center
              const prevCenter = getBlobCenter(previousState);
              startX = prevCenter.x;
              startY = prevCenter.y;
            } else {
              const prevPos = calculateNodePosition(previousState, prevIdx, prevSubspacesInState.length);
              startX = prevPos.x;
              startY = prevPos.y;
            }
          }

          // Update previous state tracking
          previousStatesRef.current.set(subspace.id, stateIdx);

          // Create interactive circle - colored by state
          const circle = new Graphics();
          const isSelected = subspace.id === selectedSubspaceId;
          const baseRadiusSize = isSelected ? nodeSelectedSize : nodeBaseSize;
          circle.circle(0, 0, baseRadiusSize);

          // Use contrasting colors for dots based on new palette
          // Latent: #211951 (deep purple) → white dots
          // Discovered: #836FFF (bright purple) → white dots
          // Engaged: #15F5BA (cyan) → dark dots
          // Saturated: #F0F3FF (light) → dark dots
          // Synapse Colors (lighter version of blobs)
          const dotColors: Record<StateIndex, number> = {
            0: 0xA090FF,  // Soft Indigo
            1: 0xD0BBFF,  // Soft Purple
            2: 0x80FFFF,  // Soft Cyan
            3: 0xFFFFFF,  // White
          };

          // Selected node gets a ring highlight
          if (isSelected) {
            circle.stroke({ color: 0xffd700, width: totalSubspaces > 50 ? 2 : 3 }); // Gold ring
          }
          circle.fill({ color: dotColors[stateIdx] });

          // Start at calculated position (either target or start for animation)
          circle.x = stateChanged ? startX : position.x;
          circle.y = stateChanged ? startY : position.y;
          circle.eventMode = 'static';
          circle.cursor = 'pointer';

          // Track if this is a double-click
          let lastClickTime = 0;

          // Hover effects
          circle.on('pointerenter', () => {
            if (!isSelected) circle.scale.set(1.5);
            setHoveredSubspace(subspace);
            onSubspaceHover?.(subspace);
          });

          circle.on('pointerleave', () => {
            if (!isSelected) circle.scale.set(1);
            setHoveredSubspace(null);
            onSubspaceHover?.(null);
          });

          circle.on('pointertap', () => {
            const now = Date.now();
            const isDoubleClick = now - lastClickTime < 300;
            lastClickTime = now;

            if (isDoubleClick) {
              // Double-click: zoom to this node
              onSubspaceDoubleClick?.(subspace);

              // Smooth zoom to node position
              const targetZoom = 2;
              const zoomTargetX = width / 2 - position.x * targetZoom;
              const zoomTargetY = height / 2 - position.y * targetZoom;

              // Animate zoom
              const zoomStartZoom = world.scale.x;
              const zoomStartX = world.x;
              const zoomStartY = world.y;
              const duration = 300;
              const startTime = Date.now();

              const animateZoom = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

                world.scale.set(zoomStartZoom + (targetZoom - zoomStartZoom) * eased);
                world.x = zoomStartX + (zoomTargetX - zoomStartX) * eased;
                world.y = zoomStartY + (zoomTargetY - zoomStartY) * eased;
                setZoom(world.scale.x);
                setPan({ x: world.x, y: world.y });

                if (progress < 1) {
                  requestAnimationFrame(animateZoom);
                }
              };
              animateZoom();
            } else {
              // Single click: navigate
              onSubspaceClick?.(subspace);
            }
          });

          nodeContainer.addChild(circle);

          // Store node data with animation state
          nodeData.push({
            id: subspace.id,
            name: subspace.name,
            x: stateChanged ? startX : position.x,  // Current position
            y: stateChanged ? startY : position.y,
            targetX: position.x,  // Target position (final destination)
            targetY: position.y,
            stateIndex: stateIdx,
            previousState: stateChanged ? previousState : null,
            markers: subspace.markers || [],
            graphics: circle,
            isAnimating: stateChanged && animateTransitions,
            animationProgress: 0,
          });
        });
      });

      // Store node data ref for animation access
      nodeDataRef.current = nodeData;

      // Zoom/Pan handlers
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
          setPan({ x: world.x, y: world.y });
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
      let lastFrameTime = Date.now();

      const animate = () => {
        if (isDestroyed) return;

        const now = Date.now();
        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;

        time += 0.016;

        // Draw each state blob with subspace-count-proportional sizing
        const hasMultipleActiveStates = stateBlobs.length > 1;

        stateBlobs.forEach(({ graphics, stateIndex }) => {
          // Use pre-calculated subspace-count-proportional radius
          const blobRadius = blobRadii[stateIndex];

          // Weather system drift: each state blob drifts slowly around center
          // Different speeds and phases for organic feel
          const driftRadius = 20;
          const driftSpeed = 0.2;

          let offsetX = 0;
          let offsetY = 0;

          if (hasMultipleActiveStates) {
            // Latent (0) stays mostly centered, others orbit slightly
            const phaseOffset = stateIndex * (Math.PI / 2);
            offsetX = Math.sin(time * driftSpeed + phaseOffset) * driftRadius;
            offsetY = Math.cos(time * driftSpeed * 0.7 + phaseOffset) * driftRadius;
          }

          // Draw blob with organic shape
          const blobPoints = nodeData.length > 50 ? 16 : 32;
          const points = drawOrganicBlob(
            centerX + offsetX,
            centerY + offsetY,
            blobRadius,
            blobPoints,
            time + stateIndex * 0.5
          );

          graphics.clear();
          // Lower opacity for overlay effect
          const alpha = 0.4;
          drawSmoothBlob(graphics, points, STATE_COLORS[stateIndex], alpha);
        });

        // Background Starfield Animation
        starContainer.rotation += 0.0002; // Very slow rotation
        starContainer.children.forEach((star, i) => {
          // Parallax or Twinkle? Let's do subtle twinkle
          star.alpha = 0.1 + Math.abs(Math.sin(time * 0.5 + i)) * 0.4;
        });

        // Draw Synaptic Connections
        connectionContainer.removeChildren();
        if (nodeData.length < 150) { // Performance limit
          const g = new Graphics();
          connectionContainer.addChild(g);

          // Connect nodes within same state that are close
          activeStates.forEach(stateIdx => {
            const nodesInState = nodeData.filter(n => n.stateIndex === stateIdx);
            // Limit connections per state to avoid spiderweb mess
            const maxConnections = 100;
            let connectionsDrawn = 0;

            for (let i = 0; i < nodesInState.length; i++) {
              if (connectionsDrawn > maxConnections) break;

              const n1 = nodesInState[i];
              // Find 2 nearest neighbors
              let nearest: { node: typeof n1, dist: number }[] = [];

              for (let j = i + 1; j < nodesInState.length; j++) {
                const n2 = nodesInState[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < 10000) { // Max connection distance (squared) -> 100px
                  nearest.push({ node: n2, dist: distSq });
                }
              }

              // Sort and take top 2
              nearest.sort((a, b) => a.dist - b.dist);
              nearest.slice(0, 2).forEach(neighbor => {
                const alpha = 1 - (neighbor.dist / 10000); // Fade out with distance
                g.moveTo(n1.x, n1.y);
                g.lineTo(neighbor.node.x, neighbor.node.y);
                g.stroke({
                  color: STATE_COLORS[stateIdx],
                  width: 1,
                  alpha: alpha * 0.3
                });
                connectionsDrawn++;
              });
            }
          });
        }

        // Performance: skip node animation for very large counts
        const shouldAnimateNodes = nodeData.length <= 100;
        const animateEveryNth = nodeData.length > 50 ? 2 : 1;

        // Animate nodes - handle state transitions and floating motion
        nodeData.forEach((node, idx) => {
          if (!node.graphics) return;

          // Handle state transition animation (dot moving between blobs)
          if (node.isAnimating) {
            node.animationProgress += deltaTime / TRANSITION_DURATION_MS;

            if (node.animationProgress >= 1) {
              // Animation complete
              node.animationProgress = 1;
              node.isAnimating = false;
              node.x = node.targetX;
              node.y = node.targetY;
              node.previousState = null;
            } else {
              // Linear interpolate from current stored position
              node.x = node.x + (node.targetX - node.x) * (deltaTime / TRANSITION_DURATION_MS) * 2;
              node.y = node.y + (node.targetY - node.y) * (deltaTime / TRANSITION_DURATION_MS) * 2;
            }

            // Apply position during transition (skip floating)
            node.graphics.x = node.x;
            node.graphics.y = node.y;

            // Pulse effect during transition to draw attention
            const transitionPulse = 1 + Math.sin(node.animationProgress * Math.PI * 3) * 0.3;
            node.graphics.scale.set(transitionPulse);
            return;
          }

          // Performance: skip floating animation for some nodes when there are many
          if (!shouldAnimateNodes || (animateEveryNth > 1 && idx % animateEveryNth !== 0)) {
            node.graphics.x = node.x;
            node.graphics.y = node.y;
            return;
          }

          // Each node has unique phase based on index
          const phase = idx * 0.7;

          // Gentle floating: small circular motion
          const floatAmount = nodeData.length > 50 ? 2 : 3;
          const floatX = Math.sin(time * 0.8 + phase) * floatAmount;
          const floatY = Math.cos(time * 0.6 + phase * 1.3) * floatAmount;

          // Subtle breathing/pulse effect (only if not hovered)
          const pulse = 1 + Math.sin(time * 1.2 + phase) * 0.1;

          // Apply animation (base position + float offset)
          node.graphics.x = node.x + floatX;
          node.graphics.y = node.y + floatY;

          // Only apply pulse if not being hovered (scale is 1.5 when hovered)
          if (node.graphics.scale.x < 1.4) {
            node.graphics.scale.set(pulse);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id, subspacesKey, massVectorKey, onSubspaceClick, onSubspaceHover, onSubspaceDoubleClick, selectedSubspaceId, animateTransitions, resizeKey]);

  // Reset zoom/pan
  const handleReset = useCallback(() => {
    if (worldRef.current) {
      worldRef.current.scale.set(1);
      worldRef.current.x = 0;
      worldRef.current.y = 0;
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full min-h-100 rounded-lg overflow-hidden"
        style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
      />

      {/* Controls - Linear Style */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (worldRef.current) {
              const newZoom = Math.max(0.3, zoom * 0.7);
              worldRef.current.scale.set(newZoom);
              setZoom(newZoom);
            }
          }}
          className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background"
        >
          <ZoomOut className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (worldRef.current) {
              const newZoom = Math.min(3, zoom * 1.3);
              worldRef.current.scale.set(newZoom);
              setZoom(newZoom);
            }
          }}
          className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background"
        >
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-6 px-2 text-[10px] gap-1 bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
        <span className="text-[10px] text-muted-foreground/60 font-mono ml-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Legend - Linear Style */}
      <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2">States</div>
        {([3, 2, 1, 0] as StateIndex[]).map(s => (
          <div key={s} className="flex items-center gap-2 mb-1 last:mb-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: `#${STATE_COLORS[s].toString(16).padStart(6, '0')}` }}
            />
            <span className="text-[10px] text-muted-foreground">{STATE_NAMES[s]}</span>
          </div>
        ))}
      </div>

      {/* Hovered subspace info - Linear Style */}
      {hoveredSubspace && (
        <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm border border-border/50 rounded-lg p-3 max-w-xs">
          <div className="text-xs font-medium text-foreground">{hoveredSubspace.name}</div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
            <span>Evidence: {(hoveredSubspace.evidence || 0).toFixed(1)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{hoveredSubspace.markers?.length || 0} markers</span>
          </div>
          {hoveredSubspace.markers && hoveredSubspace.markers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hoveredSubspace.markers.slice(0, 5).map((m, i) => (
                <span key={i} className="bg-muted text-foreground/80 text-[9px] px-1.5 py-0.5 rounded border border-border/40">
                  {m}
                </span>
              ))}
              {hoveredSubspace.markers.length > 5 && (
                <span className="text-[9px] text-muted-foreground">
                  +{hoveredSubspace.markers.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Drawing Helpers
// ============================================================================

function drawSmoothBlob(
  g: Graphics,
  points: { x: number; y: number }[],
  color: number,
  alpha: number
) {
  if (points.length < 3) return;

  g.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];

    // Catmull-Rom to Bezier
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  g.closePath();
  g.fill({ color, alpha });
}

'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { StateDot } from './report-visuals';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { GlobalReport, SpaceReport } from '@/lib/types/reports';

// ─────────────────────────────────────────────────────────────────
// Linear-Style Colors (Muted Grayscale with Subtle Accents)
// ─────────────────────────────────────────────────────────────────

const STATE_COLORS = {
    0: '#3f3f46', // Latent - zinc-700
    1: '#52525b', // Discovered - zinc-600
    2: '#71717a', // Engaged - zinc-500
    3: '#a1a1aa', // Saturated - zinc-400
};

const STATE_BORDER_COLORS = {
    0: '#52525b',
    1: '#71717a',
    2: '#a1a1aa',
    3: '#d4d4d8',
};

const STATE_NAMES: Record<number, string> = {
    0: 'Latent',
    1: 'Discovered',
    2: 'Engaged',
    3: 'Saturated',
};

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Node extends d3.SimulationNodeDatum {
    id: string;
    name: string;
    type: 'space' | 'subspace';
    state: number;
    evidence: number;
    radius: number;
    color: string;
    borderColor: string;
    parentId?: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface Link extends d3.SimulationLinkDatum<Node> {
    source: string | Node;
    target: string | Node;
    value: number;
}

interface KnowledgeGraphProps {
    report: GlobalReport | SpaceReport;
    className?: string;
}

// ─────────────────────────────────────────────────────────────────
// Knowledge Graph Component - Linear Aesthetic
// ─────────────────────────────────────────────────────────────────

export function KnowledgeGraph({ report, className }: KnowledgeGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
    const [zoom, setZoom] = useState(1);

    // Prepare Data
    const { nodes, links } = useMemo(() => {
        const nodes: Node[] = [];
        const links: Link[] = [];

        if (report.scope === 'global') {
            const globalReport = report as GlobalReport;

            globalReport.spaces.forEach(space => {
                nodes.push({
                    id: space.id,
                    name: space.name,
                    type: 'space',
                    state: space.dominantState,
                    evidence: 10,
                    radius: 8 + Math.min(space.subspaceCount, 6),
                    color: STATE_COLORS[space.dominantState as keyof typeof STATE_COLORS],
                    borderColor: STATE_BORDER_COLORS[space.dominantState as keyof typeof STATE_BORDER_COLORS],
                });
            });

        } else {
            const spaceReport = report as SpaceReport;
            const centerId = spaceReport.spaceId;

            // Central Space Node
            nodes.push({
                id: centerId,
                name: spaceReport.spaceName,
                type: 'space',
                state: spaceReport.dominantState,
                evidence: spaceReport.totalEvidence,
                radius: 14,
                color: STATE_COLORS[spaceReport.dominantState as keyof typeof STATE_COLORS],
                borderColor: STATE_BORDER_COLORS[spaceReport.dominantState as keyof typeof STATE_BORDER_COLORS],
                fx: 0,
                fy: 0,
            });

            // Subspace Nodes
            spaceReport.subspaces.forEach(sub => {
                nodes.push({
                    id: sub.id,
                    name: sub.name,
                    type: 'subspace',
                    state: sub.state,
                    evidence: sub.evidence,
                    radius: 4 + Math.min(sub.evidence, 6),
                    color: STATE_COLORS[sub.state as keyof typeof STATE_COLORS],
                    borderColor: STATE_BORDER_COLORS[sub.state as keyof typeof STATE_BORDER_COLORS],
                    parentId: centerId,
                });

                links.push({
                    source: centerId,
                    target: sub.id,
                    value: 1,
                });
            });
        }

        return { nodes, links };
    }, [report]);

    // Initialize D3 Simulation
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight || 400;

        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("viewBox", [-width / 2, -height / 2, width, height])
            .style("width", "100%")
            .style("height", "100%");

        // Add zoom behavior
        const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 3])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                setZoom(event.transform.k);
            });

        svg.call(zoomBehavior);
        zoomRef.current = zoomBehavior;

        const g = svg.append("g");

        // Simulation
        const simulation = d3.forceSimulation<Node>(nodes)
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(50))
            .force("charge", d3.forceManyBody().strength(-120))
            .force("collide", d3.forceCollide<Node>().radius(d => d.radius + 4).iterations(2))
            .force("x", d3.forceX())
            .force("y", d3.forceY());

        // Draw Links - Linear style: very thin, nearly invisible
        const link = g.append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "currentColor")
            .attr("stroke-opacity", 0.08)
            .attr("stroke-width", 1);

        // Draw Nodes - Linear style: outlined, muted fills
        const node = g.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", 0)
            .attr("fill", d => d.color)
            .attr("stroke", d => d.borderColor)
            .attr("stroke-width", 1)
            .attr("cursor", "pointer")
            .call(drag(simulation) as any);

        // Animate nodes in
        node.transition().duration(600).ease(d3.easeBackOut).attr("r", d => d.radius);

        // Hover Interactions - Linear style: subtle highlight
        node
            .on("mouseover", (event, d) => {
                setHoveredNode(d);
                d3.select(event.currentTarget)
                    .transition().duration(150)
                    .attr("stroke", "#fafafa")
                    .attr("stroke-width", 1.5)
                    .attr("r", d.radius + 2);
            })
            .on("mouseout", (event, d) => {
                setHoveredNode(null);
                d3.select(event.currentTarget)
                    .transition().duration(150)
                    .attr("stroke", d.borderColor)
                    .attr("stroke-width", 1)
                    .attr("r", d.radius);
            });

        // Tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as Node).x!)
                .attr("y1", d => (d.source as Node).y!)
                .attr("x2", d => (d.target as Node).x!)
                .attr("y2", d => (d.target as Node).y!);

            node
                .attr("cx", d => d.x!)
                .attr("cy", d => d.y!);
        });

        return () => {
            simulation.stop();
        };
    }, [nodes, links]);

    // Drag behavior
    const drag = (simulation: d3.Simulation<Node, undefined>) => {
        function dragstarted(event: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event: any) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };

    // Zoom controls
    const handleZoomIn = useCallback(() => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
        }
    }, []);

    const handleZoomOut = useCallback(() => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
        }
    }, []);

    const handleReset = useCallback(() => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
        }
    }, []);

    return (
        <div
            className={cn("relative w-full h-full overflow-hidden bg-background", className)}
            ref={containerRef}
        >
            <svg ref={svgRef} className="w-full h-full block text-muted-foreground" />

            {/* Controls - Linear Style */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background"
                >
                    <ZoomOut className="w-3 h-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
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
                {([3, 2, 1, 0] as const).map(s => (
                    <div key={s} className="flex items-center gap-2 mb-1 last:mb-0">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: STATE_COLORS[s] }}
                        />
                        <span className="text-[10px] text-muted-foreground">{STATE_NAMES[s]}</span>
                    </div>
                ))}
            </div>

            {/* Tooltip - Linear Style */}
            <AnimatePresence>
                {hoveredNode && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-3 left-3 pointer-events-none z-10 p-3 bg-background/90 backdrop-blur-sm border border-border/50 rounded-lg shadow-sm max-w-[180px]"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <StateDot state={hoveredNode.state as 0 | 1 | 2 | 3} />
                            <span className="text-xs font-medium text-foreground truncate">{hoveredNode.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-0.5 pl-4">
                            <p>Type: <span className="capitalize text-foreground/80">{hoveredNode.type}</span></p>
                            {hoveredNode.type === 'subspace' && (
                                <p>Evidence: <span className="text-foreground/80">{hoveredNode.evidence?.toFixed(1) || 0}</span></p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hint */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">
                    Drag nodes · Scroll to zoom
                </span>
            </div>
        </div>
    );
}

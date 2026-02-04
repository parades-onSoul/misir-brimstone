/**
 * PixiJS Drawing Utilities
 * 
 * Helper functions for drawing shapes with PixiJS Graphics.
 */

import { Graphics } from 'pixi.js';

/**
 * Draw a smooth blob using cardinal spline interpolation
 */
export function drawSmoothBlob(
    g: Graphics,
    points: { x: number; y: number }[],
    color: number,
    alpha: number
): void {
    if (points.length < 3) return;

    g.beginFill(color, alpha);

    // Create closed smooth curve
    const n = points.length;

    // Start at the first point
    g.moveTo(points[0].x, points[0].y);

    // Draw bezier curves through all points
    for (let i = 0; i < n; i++) {
        const p0 = points[(i + n - 1) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];

        // Calculate control points using Catmull-Rom to Bezier conversion
        const tension = 0.5;
        const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
        const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
        const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
        const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

        g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    g.endFill();
}

/**
 * Draw a circular dot
 */
export function drawDot(
    g: Graphics,
    x: number,
    y: number,
    radius: number,
    fillColor: number,
    strokeColor: number,
    strokeWidth: number = 2
): void {
    g.beginFill(fillColor);
    g.lineStyle(strokeWidth, strokeColor);
    g.drawCircle(x, y, radius);
    g.endFill();
}

/**
 * Draw a selected indicator ring
 */
export function drawSelectionRing(
    g: Graphics,
    x: number,
    y: number,
    radius: number,
    color: number = 0xffffff
): void {
    g.lineStyle(3, color, 0.8);
    g.drawCircle(x, y, radius + 4);
}

/**
 * Draw a pulsing highlight effect
 */
export function drawPulseEffect(
    g: Graphics,
    x: number,
    y: number,
    baseRadius: number,
    time: number,
    color: number = 0xffffff
): void {
    const pulseRadius = baseRadius + Math.sin(time * 0.005) * 3;
    const alpha = 0.3 + Math.sin(time * 0.005) * 0.2;

    g.lineStyle(2, color, alpha);
    g.drawCircle(x, y, pulseRadius);
}

/**
 * Create gradient-like effect using multiple fills
 */
export function drawGradientBlob(
    g: Graphics,
    points: { x: number; y: number }[],
    color: number,
    centerAlpha: number = 0.3,
    edgeAlpha: number = 0.1
): void {
    // Draw outer layer (more transparent)
    drawSmoothBlob(g, points, color, edgeAlpha);

    // Draw inner layer (less transparent) - scaled down
    const scale = 0.7;
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    const innerPoints = points.map(p => ({
        x: centerX + (p.x - centerX) * scale,
        y: centerY + (p.y - centerY) * scale,
    }));

    drawSmoothBlob(g, innerPoints, color, centerAlpha);
}

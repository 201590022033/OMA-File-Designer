import { parseCanonicalOma, normalizedTraceGeometry, traceToCartesian, sphericalSag } from "@shared/oma-engine";

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface LensGeometry {
  vertices: Float32Array;
  indices: Uint16Array;
}
export type EdgeType = "v-bevel" | "flat" | "groove";
export type BevelPlacement = "front" | "one-third-front" | "center" | "back" | "custom";
export interface EdgePreviewState { edgeType: EdgeType; bevelPlacement: BevelPlacement; bevelPositionRatio: number; grooveDepthMm: number; grooveWidthMm: number; exportStatus: "preview-only"; }
export function edgeApexZ(frontZ: number, backZ: number, ratio: number) { const r = Math.max(0, Math.min(1, ratio)); return frontZ + r * (backZ - frontZ); }

export function parseOmaContent(content: string) {
  const trace = parseCanonicalOma(content).traces[0];
  if (!trace) return { trcfmt: 0, rPoints: [], aPoints: [] };
  const geometry = normalizedTraceGeometry(trace);
  return { trcfmt: Number(trace.trcfmt[0] ?? 0), rPoints: geometry.radii, aPoints: geometry.angles };
}

export function parseOmaTracePoints(content: string, side: "R" | "L") {
  const trace = parseCanonicalOma(content).traces.find((candidate) => candidate.side === side);
  return trace ? traceToCartesian(trace) : [];
}

export function generateLensMesh(
  rPoints: number[], 
  aPoints: number[], 
  thickness: number = 3.0,
  baseCurve: number = 4.0
): LensGeometry {
  if (!rPoints.length || !aPoints.length || rPoints.length !== aPoints.length) {
    return { vertices: new Float32Array(0), indices: new Uint16Array(0) };
  }
  return generateLensMeshFromCartesian(
    rPoints.map((radius, index) => ({
      x: radius * Math.cos((aPoints[index] * Math.PI) / 180),
      y: radius * Math.sin((aPoints[index] * Math.PI) / 180),
    })), thickness, baseCurve,
  );
}

export function generateLensMeshFromCartesian(
  outline: Array<{ x: number; y: number }>,
  thickness: number = 3.0,
  baseCurve: number = 4.0,
  surfaceRadius?: number,
  edgeType: EdgeType = "v-bevel",
  bevelPositionRatio = 0.5,
  grooveWidthMm = 0.52,
  grooveDepthMm = 1.85,
  groovePositionRatio = 0.4,
): LensGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Validate input
  if (!outline.length) {
    return { vertices: new Float32Array(0), indices: new Uint16Array(0) };
  }

  const numPoints = outline.length;
  
  // Generate Front Surface Edge Loop
  // Convert polar (R, A) to cartesian (X, Y, Z)
  // Z is calculated based on Base Curve (spherical approximation)
  // Sagitta formula: s = r - sqrt(r^2 - y^2) where r is radius of curvature
  
  // 530 is index of refraction constant often used for lens surfacing tools (1.530)
  // Radius of curvature in mm = 530 / BaseCurve
  const radiusCurvature = surfaceRadius ?? (baseCurve !== 0 ? 530 / baseCurve : 9999);
  
  const frontLoop: Point[] = [];
  const backLoop: Point[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    // A is usually in degrees * 100 in OMA, so divide by 100 then to radians
    // Or sometimes just degrees. Assuming degrees for standard OMA TRCFMT=1
    // Actually, generic OMA 'A' is often integer degrees. Let's assume degrees.
    const { x, y } = outline[i];
    
    // R is radius in mm * 100 sometimes? Or just mm? Standard OMA is mm * 100 usually
    // Let's assume the values are already parsed to mm by the caller or raw.
    // If values are huge (>1000), they are likely *100.
    // Calculate Z based on base curve
    // distance from center
    const dist = Math.sqrt(x*x + y*y);
    // spherical sag
    let zFront = sphericalSag(dist, radiusCurvature);
    
    frontLoop.push({ x, y, z: zFront });
    backLoop.push({ x, y, z: zFront - thickness });
  }

  // Create vertices
  // Structure: Center Front, Center Back, then rings
  
  // Center points (approximate)
  vertices.push(0, 0, 0); // 0: Center Front
  vertices.push(0, 0, -thickness); // 1: Center Back
  
  // Add Front Loop vertices
  frontLoop.forEach(p => vertices.push(p.x, p.y, p.z));
  
  // Add Back Loop vertices
  backLoop.forEach(p => vertices.push(p.x, p.y, p.z));
  
  const offsetFront = 2;
  const offsetBack = 2 + numPoints;
  const offsetEdge = 2 + numPoints * 2;
  if (edgeType !== "flat") {
    outline.forEach(({ x, y }, index) => {
      const scale = edgeType === "groove" ? Math.max(0.9, 1 - (grooveDepthMm + grooveWidthMm / 2) / Math.max(1, Math.hypot(x, y))) : 1;
      const frontZ = frontLoop[index].z, backZ = backLoop[index].z;
      vertices.push(x * scale, y * scale, edgeApexZ(frontZ, backZ, edgeType === "groove" ? groovePositionRatio : bevelPositionRatio));
    });
  }
  
  // Generate Faces
  // Front Surface (Fan from center to edge)
  for (let i = 0; i < numPoints; i++) {
    const current = offsetFront + i;
    const next = offsetFront + ((i + 1) % numPoints);
    // Center, Next, Current (Clockwise/CCW depending on coord system)
    indices.push(0, next, current);
  }
  
  // Back Surface
  for (let i = 0; i < numPoints; i++) {
    const current = offsetBack + i;
    const next = offsetBack + ((i + 1) % numPoints);
    // Center, Current, Next (Reverse winding for back face)
    indices.push(1, current, next);
  }
  
  // Side/bevel surface. Ordinary imported traces default to a centered V-bevel.
  for (let i = 0; i < numPoints; i++) {
    const fCurrent = offsetFront + i;
    const fNext = offsetFront + ((i + 1) % numPoints);
    const bCurrent = offsetBack + i;
    const bNext = offsetBack + ((i + 1) % numPoints);
    
    if (edgeType === "flat") {
      indices.push(fCurrent, bCurrent, fNext, bCurrent, bNext, fNext);
    } else {
      const eCurrent = offsetEdge + i;
      const eNext = offsetEdge + ((i + 1) % numPoints);
      indices.push(fCurrent, eCurrent, fNext, eCurrent, eNext, fNext);
      indices.push(eCurrent, bCurrent, eNext, bCurrent, bNext, eNext);
    }
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices)
  };
}

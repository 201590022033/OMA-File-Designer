
import { parseCanonicalOma, type CanonicalOmaFile, normalizedTraceGeometry, type OmaValue } from "./oma-engine";

export type { CanonicalOmaFile, OmaValue } from "./oma-engine";

export interface OmaData {
  traces: Record<string, (number | string)[]>[]; // Array of trace dictionaries
  _FCS: Record<string, (number | string)[]>;
  [key: string]: any;
}

export function parseOmaFile(content: string): OmaData {
  const canonical = parseCanonicalOma(content);
  const data: Record<string, any> = { traces: [], _FCS: {} };
  for (const record of canonical.records) {
    if (record.scope === "fcs") {
      (data._FCS[record.key] ??= []).push(...record.values);
    } else if (record.scope === "global") {
      (data[record.key] ??= []).push(...record.values);
    }
  }
  data.traces = canonical.traces.map((trace) => {
    const result: Record<string, OmaValue[]> = { TRCFMT: [...trace.trcfmt] };
    for (const record of trace.records) if (record.key !== "TRCFMT") (result[record.key] ??= []).push(...record.values);
    return result;
  });
  return data as OmaData;
}

export interface TraceData {
  radii: number[];
  angles: number[];
  sags: number[];
  side: string;
  tnorm: number;
  fcrv: number | null;
  ztilt: number;
  panto: number;
  cdx: number;
  cdy: number;
}

export function extractTraceData(
  trace: any, 
  data: any, 
  overrides: {
    fcrv?: number;
    ztilt?: number;
    panto?: number;
    cdx?: number;
    cdy?: number;
  } = {}
): TraceData {
  const trcfmt = trace['TRCFMT'] || [1, 400, 'E', 'R', 'F'];
  // if (trcfmt.length < 5) throw new Error("Invalid TRCFMT record");
  
  const numPoints = parseInt(trcfmt[1]);
  const angleMode = trcfmt[2];
  const side = trcfmt[3];

  const radii = (trace['R'] || []).map((v: any) => Number(v));
  if (radii.length !== numPoints) {
    console.warn(`Expected ${numPoints} radii, got ${radii.length}. Formatting may be incorrect.`);
  }

  let angles: number[] = [];
  if (angleMode === 'E') {
    for (let i = 0; i < numPoints; i++) {
      angles.push(i * (360.0 / numPoints));
    }
  } else {
    const anglesH = trace['A'] || [];
    angles = anglesH.map((a: any) => Number(a) / 100.0);
  }

  const zfmt = trace['ZFMT'];
  const sags = zfmt ? (trace['Z'] || []).map((v: any) => Number(v)) : [];

  const tnorm = parseInt((data['TNORM'] || [0])[0]);
  const fcrvArr = data['FCRV'] || [null, null];
  const ztiltArr = data['ZTILT'] || [0.0, 0.0];
  const pantoArr = data['PANTO'] || [0.0, 0.0];
  const cdxArr = data['_CDX'] || [0.0, 0.0];
  const cdyArr = data['_CDY'] || [0.0, 0.0];

  const idx = side === 'R' ? 0 : 1;

  const fcrv = overrides.fcrv !== undefined ? overrides.fcrv : (fcrvArr[idx] !== null ? Number(fcrvArr[idx]) : null);
  const ztilt = overrides.ztilt !== undefined ? overrides.ztilt : (ztiltArr.length > idx ? Number(ztiltArr[idx]) / 10.0 : 0.0);
  const panto = overrides.panto !== undefined ? overrides.panto : (pantoArr.length > idx ? Number(pantoArr[idx]) : 0.0);
  const cdx = overrides.cdx !== undefined ? overrides.cdx : (cdxArr.length > idx ? Number(cdxArr[idx]) : 0.0);
  const cdy = overrides.cdy !== undefined ? overrides.cdy : (cdyArr.length > idx ? Number(cdyArr[idx]) : 0.0);

  return { radii, angles, sags, side, tnorm, fcrv, ztilt, panto, cdx, cdy };
}

export function generateLensFront(
  radii: number[], 
  angles: number[], 
  sags: number[], 
  side: string, 
  tnorm: number, 
  fcrv: number | null, 
  asphericK: number
): [number, number, number][] {
  let verticesFront: [number, number, number][] = [];

  for (let i = 0; i < radii.length; i++) {
    const r_mm = radii[i] / 100.0;
    const theta_rad = (angles[i] * Math.PI) / 180.0;
    const x = r_mm * Math.cos(theta_rad);
    const y = r_mm * Math.sin(theta_rad);
    const z = (i < sags.length) ? sags[i] / 100.0 : 0.0;
    verticesFront.push([x, y, z]);
  }

  if (side === 'L') {
    verticesFront = verticesFront.map(([x, y, z]) => [-x, y, z]);
  }

  // Curve simulation if sags are missing or if we want to apply base curve
  if (tnorm === 3 && fcrv !== null && fcrv !== 0 && sags.length === 0) {
    const n = 1.53;
    const R = (n - 1) * 1000 / fcrv;
    verticesFront = verticesFront.map(([x, y, z]) => {
      const rho = Math.sqrt(x*x + y*y);
      let sag = 0.0;
      if (rho < R) {
        sag = R - Math.sqrt(R*R - rho*rho);
      }
      return [x, y, z + sag];
    });
  }
  
  // Aspheric correction
  if (asphericK !== 0.0 && fcrv !== null && fcrv !== 0) {
     const n = 1.53;
     const c = fcrv / ((n - 1) * 1000);
     verticesFront = verticesFront.map(([x, y, z]) => {
        const rho2 = x*x + y*y;
        const denom = 1 + Math.sqrt(1 - (1 + asphericK) * c * c * rho2);
        const sag = denom === 0 ? 0 : (c * rho2) / denom;
        return [x, y, sag];
     });
  }

  return verticesFront;
}

export function generateBeveledEdge(
  frontPoints: [number, number, number][],
  backPoints: [number, number, number][],
  thicknesses: number[],
  minThick: number,
  maxThick: number,
  bevelType: string,
  bevelSubtype: string
): { vertices: [number, number, number][], indices: number[] } {
  const num = frontPoints.length;
  const newVertices: [number, number, number][] = [];
  const indices: number[] = [];
  
  // We will flatten the structure: 
  // We need to return vertices and indices for a single mesh.
  // The Python code generates faces as "f i j k l" (quads) or triangles. 
  // We will generate triangles for React Three Fiber.

  // Helper to add a quad as two triangles
  const addQuad = (v1: number, v2: number, v3: number, v4: number) => {
    // v1, v2, v3, v4 are indices in the *current* vertices list
    // Python OBJ format is 1-based, we are 0-based.
    // Quad v1-v2-v3-v4 -> Triangles v1-v2-v3 and v1-v3-v4 (or similar)
    indices.push(v1, v2, v3);
    indices.push(v1, v3, v4);
  };

  // 1. Edge Normals
  const edgeNormals: [number, number][] = [];
  for (let i = 0; i < num; i++) {
    const [fx, fy] = frontPoints[i];
    const [bx, by] = backPoints[i];
    const ex = (fx + bx) / 2;
    const ey = (fy + by) / 2;
    const len = Math.sqrt(ex*ex + ey*ey);
    if (len > 0) {
      edgeNormals.push([ex/len, ey/len]);
    } else {
      edgeNormals.push([0, 0]);
    }
  }

  // Vertices layout in Python script:
  // 1..num: Front Trace
  // num+1..2*num: Back Trace
  // 2*num+1...: Generated edge vertices
  
  // Our layout:
  // 0..num-1: Front
  // num..2*num-1: Back
  newVertices.push(...frontPoints);
  newVertices.push(...backPoints);
  
  const startIdx = 2 * num;

  if (bevelType === "Standard Bevel") {
    let ratio = 0.5;
    if (bevelSubtype === "normal front") ratio = 0.0;
    else if (bevelSubtype === "1/3 front") ratio = 0.333;
    else if (bevelSubtype === "1/2") ratio = 0.5;
    else if (bevelSubtype === "on back") ratio = 1.0;

    const apexRing: [number, number, number][] = [];
    for (let i = 0; i < num; i++) {
        const [fx, fy, fz] = frontPoints[i];
        const [bx, by, bz] = backPoints[i];
        apexRing.push([
            fx + ratio * (bx - fx),
            fy + ratio * (by - fy),
            fz + ratio * (bz - fz)
        ]);
    }
    newVertices.push(...apexRing);
    const apexOffset = startIdx;

    for (let i = 0; i < num; i++) {
        const j = (i + 1) % num;
        // Front to Apex
        // Python: f {i+1} {j+1} {apex_offset + j + 1} {apex_offset + i + 1}
        // Our Indices: i, j, apexOffset + j, apexOffset + i
        addQuad(i, j, apexOffset + j, apexOffset + i);

        // Back to Apex
        // Python: f {num + i + 1} {num + j + 1} {apex_offset + j + 1} {apex_offset + i + 1}
        // Note: Python faces might be oriented differently. Let's stick to standard winding (CCW).
        // If it looks inside out, we flip.
        addQuad(num + i, num + j, apexOffset + j, apexOffset + i);
    }

  } else if (bevelType === "Rimless Flat") {
      const chamferSize = 0.5;
      const frontChamfer: [number, number, number][] = [];
      const backChamfer: [number, number, number][] = [];
      
      for (let i = 0; i < num; i++) {
          const [fx, fy, fz] = frontPoints[i];
          const [bx, by, bz] = backPoints[i];
          const [nx, ny] = edgeNormals[i];
          // math.radians(45) is approx 0.785. sin(45) ~ 0.707.
          const offset = chamferSize / 0.70710678; 
          
          frontChamfer.push([fx - offset * nx, fy - offset * ny, fz]);
          backChamfer.push([bx - offset * nx, by - offset * ny, bz]);
      }
      
      newVertices.push(...frontChamfer);
      newVertices.push(...backChamfer);
      
      const fcOffset = startIdx;
      const bcOffset = startIdx + num;
      
      for (let i = 0; i < num; i++) {
          const j = (i + 1) % num;
          // Front to Front Chamfer
          addQuad(i, j, fcOffset + j, fcOffset + i);
          
          // Front Chamfer to Back Chamfer (The flat edge)
          addQuad(fcOffset + i, fcOffset + j, bcOffset + j, bcOffset + i);
          
          // Back to Back Chamfer
          addQuad(num + i, num + j, bcOffset + j, bcOffset + i);
      }
  } else if (bevelType === "Nylon Groove") {
      const grooveWidth = 0.52;
      const grooveDepth = 1.85;
      const posRatio = 0.4;
      
      const outerLeft: [number, number, number][] = [];
      const outerRight: [number, number, number][] = [];
      const innerRing: [number, number, number][] = [];
      
      for (let i = 0; i < num; i++) {
          const [fx, fy, fz] = frontPoints[i];
          const [bx, by, bz] = backPoints[i];
          const [nx, ny] = edgeNormals[i];
          
          const midX = fx + posRatio * (bx - fx);
          const midY = fy + posRatio * (by - fy);
          const midZ = fz + posRatio * (bz - fz);
          
          const halfWidth = grooveWidth / 2;
          outerLeft.push([midX + halfWidth * nx, midY + halfWidth * ny, midZ]);
          outerRight.push([midX - halfWidth * nx, midY - halfWidth * ny, midZ]);
          innerRing.push([midX - grooveDepth * nx, midY - grooveDepth * ny, midZ]);
      }
      
      newVertices.push(...outerLeft);
      newVertices.push(...outerRight);
      newVertices.push(...innerRing);
      
      const olOffset = startIdx;
      const orOffset = startIdx + num;
      const innerOffset = startIdx + 2 * num;
      
      for (let i = 0; i < num; i++) {
          const j = (i + 1) % num;
          // Outer Left to Inner Ring
          addQuad(olOffset + i, olOffset + j, innerOffset + j, innerOffset + i);
          // Outer Right to Inner Ring
          addQuad(orOffset + i, orOffset + j, innerOffset + j, innerOffset + i);
          
          // We also need to connect Front to Outer Left and Back to Outer Right? 
          // The python script only generates the groove faces in the 'elif' block for Nylon Groove
          // It looks like it assumes the flat part connects to these?
          // Wait, the python code: 
          // new_faces.append(f"usemtl thick{level}\nf {ol_offset + i + 1} {ol_offset + j + 1} {inner_offset + j + 1} {inner_offset + i + 1}")
          // new_faces.append(f"usemtl thick{level}\nf {or_offset + i + 1} {or_offset + j + 1} {inner_offset + j + 1} {inner_offset + i + 1}")
          // It seems it MISSES the connection from front trace to the groove edge?
          // Or maybe I missed it in the read.
          // Let's assume we need to close the mesh.
          // Front Trace to Outer Left?
          addQuad(i, j, olOffset + j, olOffset + i);
          // Back Trace to Outer Right?
          addQuad(num + i, num + j, orOffset + j, orOffset + i);
      }
  }

  // Also fill the front and back faces?
  // The python script creates an "edge" mesh (a ring). It doesn't seem to triangulate the lens surface itself (the cap).
  // But a lens viewer usually needs the surface.
  // We can add a simple fan triangulation for the caps if needed, but let's stick to the edge for now as per the script.
  // Actually, standard lenses have surfaces. The script is called "generate_beveled_edge", implies it just makes the edge.
  // But `generate_lens_front` makes vertices.
  // If we want a solid lens, we need to triangulate the front and back surfaces.
  // Simple approach: Triangle fan from a center point (0,0, sag_at_0).
  // Calculate center:
  const centerFront: [number, number, number] = [0, 0, frontPoints[0][2]]; // Approximate center Z
  const centerBack: [number, number, number] = [0, 0, backPoints[0][2]];

  // Add centers
  const centerFrontIdx = newVertices.length;
  newVertices.push(centerFront);
  const centerBackIdx = newVertices.length;
  newVertices.push(centerBack);

  // Triangulate Front Cap
  for (let i = 0; i < num; i++) {
      const j = (i + 1) % num;
      // Center -> i -> j (Clockwise or CCW?)
      indices.push(centerFrontIdx, j, i); 
  }

  // Triangulate Back Cap
  for (let i = 0; i < num; i++) {
      const j = (i + 1) % num;
      // Center -> i -> j (Back is usually flipped, so maybe i -> j)
      indices.push(centerBackIdx, num + i, num + j);
  }

  return { vertices: newVertices, indices };
}

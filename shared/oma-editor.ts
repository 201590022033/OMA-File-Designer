import { CanonicalOmaFile, CanonicalTrace, normalizedTraceGeometry, traceToCartesian, writeCanonicalOma } from "./oma-engine";

export interface ShapeEdit { horizontalMm?: number; verticalMm?: number; rotationDeg?: number; }

function cross(ax:number, ay:number, bx:number, by:number) { return ax * by - ay * bx; }

function rayRadius(points: Array<{x:number;y:number}>, angle:number) {
  const dx=Math.cos(angle), dy=Math.sin(angle); let best=0;
  for(let i=0;i<points.length;i++) { const a=points[i], b=points[(i+1)%points.length]; const ex=b.x-a.x, ey=b.y-a.y; const den=cross(dx,dy,ex,ey); if(Math.abs(den)<1e-12) continue; const t=cross(a.x,a.y,ex,ey)/den; const u=cross(a.x,a.y,dx,dy)/den; if(t>=0 && u>=0 && u<=1) best=Math.max(best,t); }
  return best;
}

export function traceDimensions(trace: CanonicalTrace) { const p=traceToCartesian(trace); return { width:Math.max(...p.map(x=>x.x))-Math.min(...p.map(x=>x.x)), height:Math.max(...p.map(x=>x.y))-Math.min(...p.map(x=>x.y)) }; }

export function editTrace(trace: CanonicalTrace, edit: ShapeEdit) {
  const source=traceToCartesian(trace), d=normalizedTraceGeometry(trace); const dims=traceDimensions(trace);
  const sx=edit.horizontalMm == null ? 1 : edit.horizontalMm/dims.width; const sy=edit.verticalMm == null ? 1 : edit.verticalMm/dims.height;
  const rot=(edit.rotationDeg ?? 0)*Math.PI/180; const transformed=source.map(p=>({x:(p.x*sx)*Math.cos(rot)-(p.y*sy)*Math.sin(rot),y:(p.x*sx)*Math.sin(rot)+(p.y*sy)*Math.cos(rot)}));
  const radii=d.angles.map(a=>rayRadius(transformed,a*Math.PI/180));
  return { radii, angles:d.angles, points:d.angles.map((a,i)=>({x:radii[i]*Math.cos(a*Math.PI/180),y:radii[i]*Math.sin(a*Math.PI/180)})) };
}

export function applyShapeEdit(source: CanonicalOmaFile, sides: Array<"R"|"L">, edit: ShapeEdit) {
  const file=structuredClone(source);
  for(const trace of file.traces.filter(t=>sides.includes(t.side as "R"|"L"))) {
    const result=editTrace(trace,edit); let offset=0;
    for(const record of trace.records.filter(r=>r.key==="R")) { const n=record.values.length; record.values=result.radii.slice(offset,offset+n).map(v=>Math.round(v*100)); offset+=n; }
  }
  const hbox=file.records.find(r=>r.key==="HBOX"); if(hbox) { const original=source.records.find(r=>r.key==="HBOX")!.values.map(Number); hbox.values=original.map((v,i)=>sides.includes(i===0?"R":"L") && edit.horizontalMm!=null ? edit.horizontalMm : v); }
  const vbox=file.records.find(r=>r.key==="VBOX"); if(vbox) { const original=source.records.find(r=>r.key==="VBOX")!.values.map(Number); vbox.values=original.map((v,i)=>sides.includes(i===0?"R":"L") && edit.verticalMm!=null ? edit.verticalMm : v); }
  return file;
}

export { writeCanonicalOma };

import { parseCanonicalOma, traceToCartesian } from "@shared/oma-engine";
import { traceDimensions } from "@shared/oma-editor";

export function ShapeEditor2D({ originalContent, editedContent, side }: { originalContent: string; editedContent: string; side: "R"|"L" }) {
  const original = parseCanonicalOma(originalContent).traces.find(t => t.side === side);
  const edited = parseCanonicalOma(editedContent).traces.find(t => t.side === side);
  if (!original || !edited) return null;
  const op=traceToCartesian(original), ep=traceToCartesian(edited); const all=[...op,...ep];
  const minX=Math.min(...all.map(p=>p.x)), maxX=Math.max(...all.map(p=>p.x)), minY=Math.min(...all.map(p=>p.y)), maxY=Math.max(...all.map(p=>p.y));
  const sx=(x:number)=>10+(x-minX)/(maxX-minX||1)*280, sy=(y:number)=>190-(y-minY)/(maxY-minY||1)*170;
  const points=(p:{x:number;y:number}[])=>p.map(q=>`${sx(q.x)},${sy(q.y)}`).join(" "); const d=traceDimensions(edited);
  return <div className="rounded-lg border border-white/10 bg-black/30 p-3"><div className="mb-2 text-xs text-white">2D Shape Preview · {side === "R" ? "Right" : "Left"} · HBOX {d.width.toFixed(2)} mm · VBOX {d.height.toFixed(2)} mm</div><svg viewBox="0 0 300 210" className="w-full max-h-64"><line x1="10" y1={sy(0)} x2="290" y2={sy(0)} stroke="#64748b" strokeDasharray="3 3"/><line x1={sx(0)} y1="10" x2={sx(0)} y2="200" stroke="#64748b" strokeDasharray="3 3"/><polyline points={points(op)} fill="none" stroke="#94a3b8" strokeDasharray="4 3"/><polyline points={points(ep)} fill="none" stroke="#38bdf8" strokeWidth="1.5"/><circle cx={sx(ep[0].x)} cy={sy(ep[0].y)} r="3" fill="#fbbf24"/><text x="14" y="18" fill="white" fontSize="9">point 0 → increasing index</text></svg></div>;
}

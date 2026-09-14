import { useParams, useLocation } from "wouter";
import { useLens, useDeleteLens } from "@/hooks/use-lenses";
import { Header } from "@/components/Header";
import { Lens3DViewer, type TraceSelection } from "@/components/Lens3DViewer";
import type { EdgeType, BevelPlacement } from "@/lib/oma-parser";
import { applyShapeEdit, traceDimensions } from "@shared/oma-editor";
import { ShapeEditor2D } from "@/components/ShapeEditor2D";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, Download, Settings2, Info, Loader2, Eye } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { parseCanonicalOma, writeCanonicalOma, binocularPlacement } from "@shared/oma-engine";

function writeEdited(content: string, selection: TraceSelection, horizontalMm?: number, verticalMm?: number, rotationDeg = 0) {
  const file = parseCanonicalOma(content);
  const sides: ('R'|'L')[] = selection === 'Both' ? ['R', 'L'] : [selection as 'R'|'L'];
  return writeCanonicalOma(applyShapeEdit(file, sides, { horizontalMm, verticalMm, rotationDeg }));
}

export default function Viewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: lens, isLoading, isError } = useLens(Number(id));
  const deleteLens = useDeleteLens();
  const placement = lens ? binocularPlacement(parseCanonicalOma(lens.omaContent)) : null;

  // Viewer Controls State
  const [thickness, setThickness] = useState(3.0);
  const [baseCurve, setBaseCurve] = useState(4.0);
  const [showWireframe, setShowWireframe] = useState(false);
  const [traceSelection, setTraceSelection] = useState<TraceSelection>('Both');
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [edgeType, setEdgeType] = useState<EdgeType>('v-bevel');
  const [bevelPlacement, setBevelPlacement] = useState<BevelPlacement>('center');
  const [customRatio, setCustomRatio] = useState(0.5);
  const [grooveWidthMm, setGrooveWidthMm] = useState(0.52);
  const [grooveDepthMm, setGrooveDepthMm] = useState(1.85);
  const [groovePositionRatio, setGroovePositionRatio] = useState(0.4);
  const placementRatio = bevelPlacement === 'front' ? 0 : bevelPlacement === 'one-third-front' ? 0.333 : bevelPlacement === 'back' ? 1 : bevelPlacement === 'custom' ? customRatio : 0.5;
  const [editMode, setEditMode] = useState(false);
  const [lockAspect, setLockAspect] = useState(true);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const originalContent = lens?.omaContent ?? "";
  const activeContent = editedContent ?? originalContent;
  const originalFile = originalContent ? parseCanonicalOma(originalContent) : null;
  const originalEdgeRecords = originalFile?.records.filter(record => /bevel|groove|edge|thick/i.test(record.key)) ?? [];
  const selectedTrace = originalFile?.traces.find(t => t.side === (traceSelection === 'L' ? 'L' : 'R'));
  const originalDims = selectedTrace ? traceDimensions(selectedTrace) : { width: 0, height: 0 };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading OMA shape job...</p>
        </div>
      </div>
    );
  }

  if (isError || !lens) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-white">Shape job not found</h1>
        <Button onClick={() => setLocation("/")} variant="outline">Go Back</Button>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteLens.mutateAsync(lens.id);
      setLocation("/");
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = () => {
    const canonical = parseCanonicalOma(activeContent);
    const blob = new Blob([writeCanonicalOma(canonical)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${lens.name || "lens"}${editedContent ? "-edited" : ""}.oma`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground h-screen flex flex-col overflow-hidden">
      <Header />
      
      <div className="flex flex-1 pt-16 h-[calc(100vh-64px)]">
        {/* Left Sidebar - Controls */}
        <aside className="w-80 border-r border-white/10 bg-secondary/30 backdrop-blur-sm overflow-y-auto hidden md:flex flex-col">
          <div className="p-6 border-b border-white/10">
            <Button 
              variant="ghost" 
              size="sm" 
              className="mb-4 pl-0 text-muted-foreground hover:text-white hover:bg-transparent group"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-bold font-display text-white break-words leading-tight">
              {lens.name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-mono bg-primary/20 text-primary px-2 py-0.5 rounded uppercase">OMA V3.10</span>
              <span className="text-[10px] text-muted-foreground">ID: {lens.id}</span>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-8">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Frame Trace</h3>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/30 p-1">
                {(['R', 'L', 'Both'] as TraceSelection[]).map((selection) => (
                  <Button key={selection} size="sm" variant={traceSelection === selection ? "default" : "ghost"} onClick={() => setTraceSelection(selection)} className="text-xs">
                    {selection === 'R' ? 'Right' : selection === 'L' ? 'Left' : 'Both'}
                  </Button>
                ))}
              </div>
              {placement && placement.centerDistance !== null && (
                <p className="text-[10px] text-muted-foreground">Binocular spacing: {placement.centerDistance.toFixed(2)} mm (DBL {placement.dbl?.toFixed(2)} mm)</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Geometry diagnostics</span>
                <Switch checked={debugOverlay} onCheckedChange={setDebugOverlay} />
              </div>
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Edit Shape</span><Switch checked={editMode} onCheckedChange={setEditMode} /></div>
              {editMode && <div className="space-y-3 rounded border border-primary/20 p-3">
                <label className="block text-xs text-muted-foreground">Horizontal Size <input type="number" step="0.01" defaultValue={originalDims.width.toFixed(2)} onChange={e => { const v=Number(e.target.value); setEditedContent(writeEdited(activeContent, traceSelection, v, lockAspect ? originalDims.height*v/originalDims.width : undefined, 0)); }} className="mt-1 w-full rounded bg-black/40 p-1 text-white" /></label>
                <label className="block text-xs text-muted-foreground">Vertical Size <input type="number" step="0.01" defaultValue={originalDims.height.toFixed(2)} onChange={e => setEditedContent(writeEdited(activeContent, traceSelection, undefined, Number(e.target.value), 0))} className="mt-1 w-full rounded bg-black/40 p-1 text-white" /></label>
                <label className="block text-xs text-muted-foreground">Rotation (degrees) <input type="number" step="0.1" defaultValue="0" onChange={e => setEditedContent(writeEdited(activeContent, traceSelection, undefined, undefined, Number(e.target.value)))} className="mt-1 w-full rounded bg-black/40 p-1 text-white" /></label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={lockAspect} onChange={e => setLockAspect(e.target.checked)} /> Lock Aspect Ratio</label>
                <p className="text-[10px] text-amber-300">Edge preview only — bevel/groove placement is not written to OMA.</p>
                {originalEdgeRecords.length > 0 && <p className="text-[10px] text-amber-300">Original edge-related OMA records will be preserved unchanged on export.</p>}
                <Button size="sm" variant="outline" onClick={() => setEditedContent(null)}>Reset Shape</Button>
                {editedContent && <p className="text-[10px] text-primary">Unsaved shape changes</p>}
              </div>}
            </div>
            {/* View Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Parameters
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Center Thickness</span>
                    <span className="text-white font-mono">{thickness.toFixed(1)} mm</span>
                  </div>
                  <Slider 
                    value={[thickness]} 
                    onValueChange={(val) => setThickness(val[0])} 
                    min={1.0} 
                    max={10.0} 
                    step={0.1}
                    className="cursor-pointer" 
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Base Curve</span>
                    <span className="text-white font-mono">{baseCurve.toFixed(1)} D</span>
                  </div>
                  <Slider 
                    value={[baseCurve]} 
                    onValueChange={(val) => setBaseCurve(val[0])} 
                    min={0.5} 
                    max={10.0} 
                    step={0.25}
                    className="cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Display Options */}
            <div className="space-y-4">
               <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Display
                </h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Show Wireframe</span>
                  <Switch 
                    checked={showWireframe} 
                    onCheckedChange={setShowWireframe} 
                  />
                </div>
                <label className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Edge Type</span>
                  <select value={edgeType} onChange={(event) => setEdgeType(event.target.value as EdgeType)} className="rounded bg-black/40 border border-white/10 px-2 py-1 text-white text-xs">
                    <option value="v-bevel">V-bevel</option><option value="flat">Flat</option><option value="groove">Groove</option>
                  </select>
                </label>
                {edgeType === 'v-bevel' && <label className="flex items-center justify-between text-sm text-muted-foreground"><span>Placement</span><select value={bevelPlacement} onChange={e => setBevelPlacement(e.target.value as BevelPlacement)} className="rounded bg-black/40 border border-white/10 px-2 py-1 text-white text-xs"><option value="front">Front</option><option value="one-third-front">1/3 Front</option><option value="center">Center</option><option value="back">Back</option><option value="custom">Custom</option></select></label>}
                {edgeType === 'v-bevel' && bevelPlacement === 'custom' && <label className="block text-xs text-muted-foreground">Custom position through edge thickness ({customRatio.toFixed(2)})<input type="range" min="0" max="1" step="0.01" value={customRatio} onChange={e => setCustomRatio(Number(e.target.value))} className="w-full" /></label>}
                {edgeType === 'groove' && <div className="space-y-2 text-xs text-muted-foreground"><label>Groove width ({grooveWidthMm.toFixed(2)} mm)<input type="range" min="0.1" max="2" step="0.01" value={grooveWidthMm} onChange={e => setGrooveWidthMm(Number(e.target.value))} className="w-full" /></label><label>Groove depth ({grooveDepthMm.toFixed(2)} mm)<input type="range" min="0.1" max="3" step="0.01" value={grooveDepthMm} onChange={e => setGrooveDepthMm(Number(e.target.value))} className="w-full" /></label><label>Groove position ({groovePositionRatio.toFixed(2)})<input type="range" min="0" max="1" step="0.01" value={groovePositionRatio} onChange={e => setGroovePositionRatio(Number(e.target.value))} className="w-full" /></label></div>}
                <p className="text-[10px] text-amber-300">Edge preview only — these settings are not written to OMA.</p>
            </div>

            <Separator className="bg-white/10" />

            {/* Metadata Snippet */}
            <div className="space-y-3">
               <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Info className="w-4 h-4" /> Raw Data
                </h3>
                <div className="bg-black/40 rounded-lg p-3 font-mono text-[10px] text-muted-foreground overflow-x-auto border border-white/5 max-h-40">
                  {lens.omaContent.slice(0, 300)}...
                </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/10 mt-auto flex gap-3">
             <Button onClick={handleExport} variant="outline" className="flex-1 border-white/10 hover:bg-white/5 text-white">
               <Download className="w-4 h-4 mr-2" /> Export
             </Button>

             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-secondary border-white/10">
                <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete this shape job?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete the OMA shape job from your library.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>

        {/* Main Content - 3D View */}
        <main className="flex-1 relative bg-black">
          <div className="absolute top-4 left-4 z-10 md:hidden">
             <Button size="sm" variant="secondary" onClick={() => setLocation("/")}>
               <ArrowLeft className="w-4 h-4 mr-2" /> Back
             </Button>
          </div>
          
          <Lens3DViewer 
            omaContent={activeContent} 
            thickness={thickness} 
            baseCurve={baseCurve}
            showWireframe={showWireframe}
            traceSelection={traceSelection}
            debugOverlay={debugOverlay}
            edgeType={edgeType}
            bevelPlacement={bevelPlacement}
            bevelPositionRatio={placementRatio}
            grooveWidthMm={grooveWidthMm}
            grooveDepthMm={grooveDepthMm}
            groovePositionRatio={groovePositionRatio}
          />
          {editMode && <div className="absolute bottom-4 left-4 right-4 z-10 max-w-md"><ShapeEditor2D originalContent={originalContent} editedContent={activeContent} side={traceSelection === 'L' ? 'L' : 'R'} /></div>}
          
          {/* Mobile floating controls toggle could go here */}
        </main>
      </div>
    </div>
  );
}

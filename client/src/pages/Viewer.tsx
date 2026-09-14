import { useParams, useLocation } from "wouter";
import { useLens, useDeleteLens } from "@/hooks/use-lenses";
import { Header } from "@/components/Header";
import { Lens3DViewer } from "@/components/Lens3DViewer";
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
import { parseCanonicalOma, writeCanonicalOma } from "@shared/oma-engine";

export default function Viewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: lens, isLoading, isError } = useLens(Number(id));
  const deleteLens = useDeleteLens();

  // Viewer Controls State
  const [thickness, setThickness] = useState(3.0);
  const [baseCurve, setBaseCurve] = useState(4.0);
  const [showWireframe, setShowWireframe] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'data'>('visual');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading lens data...</p>
        </div>
      </div>
    );
  }

  if (isError || !lens) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-white">Lens not found</h1>
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
    const canonical = parseCanonicalOma(lens.omaContent);
    const blob = new Blob([writeCanonicalOma(canonical)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${lens.name || "lens"}.oma`;
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
                  <AlertDialogTitle className="text-white">Delete this lens?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete the lens data from your library.
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
            omaContent={lens.omaContent} 
            thickness={thickness} 
            baseCurve={baseCurve}
            showWireframe={showWireframe}
          />
          
          {/* Mobile floating controls toggle could go here */}
        </main>
      </div>
    </div>
  );
}

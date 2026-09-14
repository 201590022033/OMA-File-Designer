import { useState, useRef } from "react";
import { useCreateLens } from "@/hooks/use-lenses";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UploadModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const createLens = useCreateLens();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith('.oma')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a .oma file",
          variant: "destructive"
        });
        return;
      }
      setFile(selectedFile);
      setPreviewName(selectedFile.name.replace('.oma', ''));
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      const content = await file.text();
      
      // Simple parse to extract name if possible, or use filename
      let name = previewName;
      
      await createLens.mutateAsync({
        name,
        omaContent: content,
      });
      
      setOpen(false);
      setFile(null);
      setPreviewName("");
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-secondary/95 backdrop-blur-xl border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Upload Lens File</DialogTitle>
          <DialogDescription>
            Import standard OMA files to visualize and analyze lens geometry.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div 
            className={`
              relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center
              ${file 
                ? "border-primary/50 bg-primary/5" 
                : "border-white/10 hover:border-white/20 hover:bg-white/5 cursor-pointer"
              }
            `}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept=".oma"
              onChange={handleFileChange}
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-medium text-white">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-medium text-white">Click to select</p>
                  <p className="text-sm text-muted-foreground">or drag and drop .OMA file</p>
                </div>
              </div>
            )}
          </div>

          {file && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Lens Name</label>
              <input 
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                placeholder="Enter lens name..."
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || createLens.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
          >
            {createLens.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {createLens.isPending ? "Uploading..." : "Import Lens"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

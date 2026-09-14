import { Link, useLocation } from "wouter";
import { Upload as UploadIcon, FileText, Search, Settings, Grid, Box } from "lucide-react";
import { useLenses } from "@/hooks/use-lenses";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { UploadButton } from "./UploadButton";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Sidebar() {
  const [location] = useLocation();
  const { data: lenses, isLoading } = useLenses();
  const [search, setSearch] = useState("");

  const filteredLenses = lenses?.filter(lens => 
    lens.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 border-r border-border h-screen flex flex-col bg-card/30 backdrop-blur-xl">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Box className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight">LensLab<span className="text-primary">.io</span></h1>
        </div>
        
        <div className="space-y-4">
          <UploadButton />
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search files..." 
              className="pl-9 h-10 bg-background/50 border-transparent focus:bg-background transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span>Files Library</span>
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{filteredLenses?.length || 0}</span>
        </div>
        
        <ScrollArea className="flex-1 px-3">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 pb-4">
              {filteredLenses?.map((lens) => {
                const isActive = location === `/view/${lens.id}`;
                return (
                  <Link 
                    key={lens.id} 
                    href={`/view/${lens.id}`}
                    className={cn(
                      "group flex flex-col gap-1 p-3 rounded-xl transition-all duration-200 border border-transparent hover:bg-muted/50",
                      isActive ? "bg-primary/5 border-primary/20 shadow-sm" : ""
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className={cn(
                          "w-4 h-4 flex-shrink-0 transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        <span className={cn(
                          "font-medium truncate text-sm",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {lens.name}
                        </span>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />}
                    </div>
                    <div className="pl-6 text-[10px] text-muted-foreground font-mono flex gap-2">
                      <span>OMA</span>
                      <span>•</span>
                      <span>{new Date(lens.createdAt!).toLocaleDateString()}</span>
                    </div>
                  </Link>
                );
              })}
              
              {filteredLenses?.length === 0 && (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Grid className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No files found</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload an OMA file to get started</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-border/50 bg-muted/10">
        <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full p-2 rounded-lg hover:bg-muted/50">
          <Settings className="w-4 h-4" />
          <span>System Preferences</span>
        </button>
      </div>
    </div>
  );
}

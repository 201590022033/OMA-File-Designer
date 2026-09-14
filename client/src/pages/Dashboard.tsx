import { useLenses } from "@/hooks/use-lenses";
import { Header } from "@/components/Header";
import { UploadModal } from "@/components/UploadModal";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, ArrowRight, Eye, Clock, Box } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: lenses, isLoading, isError } = useLenses();
  const [search, setSearch] = useState("");

  const filteredLenses = lenses?.filter(lens => 
    lens.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Hero Section */}
        <div className="mb-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary to-secondary/50 border border-white/5 p-8 md:p-12 shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold font-display tracking-tight text-white mb-4"
            >
              Precision Lens Visualization
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground mb-8 leading-relaxed"
            >
              Upload, analyze, and visualize OMA lens files in real-time 3D. 
              Inspect curvature, thickness, and bevel profiles with engineering-grade precision.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex gap-4"
            >
              <UploadModal>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 rounded-xl font-semibold px-8">
                  <Plus className="w-5 h-5 mr-2" />
                  Upload New Lens
                </Button>
              </UploadModal>
              <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 text-white rounded-xl">
                Documentation
              </Button>
            </motion.div>
          </div>
          
          {/* Decorative background visual */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[url('https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay mask-gradient" />
          <div className="absolute top-1/2 right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
        </div>

        {/* List Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Library</h2>
            <p className="text-sm text-muted-foreground">Manage your uploaded lens profiles</p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                placeholder="Search lenses..." 
                className="w-full bg-secondary/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 shrink-0">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20 bg-destructive/5 rounded-2xl border border-destructive/20">
            <p className="text-destructive font-medium">Failed to load lenses. Please try again.</p>
          </div>
        ) : filteredLenses?.length === 0 ? (
          <div className="text-center py-20 bg-secondary/30 rounded-2xl border border-dashed border-white/10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No lenses found</h3>
            <p className="text-muted-foreground mb-6">Upload your first OMA file to get started.</p>
            <UploadModal>
              <Button className="bg-primary text-primary-foreground">Upload Lens</Button>
            </UploadModal>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLenses?.map((lens) => (
              <motion.div 
                key={lens.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="group bg-secondary border border-white/5 hover:border-primary/50 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-300">
                      <Glasses className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex items-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-white/5 px-2 py-1 rounded">
                      OMA
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors truncate">
                    {lens.name}
                  </h3>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-3 h-3 mr-2" />
                      {lens.createdAt ? format(new Date(lens.createdAt), 'MMM d, yyyy') : 'Unknown Date'}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Box className="w-3 h-3 mr-2" />
                      Size: {Math.round(lens.omaContent.length / 1024 * 10) / 10} KB
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <Link href={`/view/${lens.id}`}>
                      <span className="text-sm font-medium text-white group-hover:underline flex items-center cursor-pointer">
                        View 3D Model <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </div>
                  
                  {/* Hover Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Glasses(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 16.5c-1.34-1.63-2.79-2.5-4.5-2.5A5.5 5.5 0 0 0 0 19.5v1h10v-4ZM24 20.5v-1a5.5 5.5 0 0 0-5.5-5.5c-1.71 0-3.16.87-4.5 2.5v4h10Z" />
    </svg>
  );
}

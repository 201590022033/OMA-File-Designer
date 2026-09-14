import { Link, useLocation } from "wouter";
import { Glasses, Box, Upload, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutGrid },
    { label: "Library", href: "/#library", icon: Box },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto h-full px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity">
          <div className="p-2 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
            <Glasses className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight leading-none text-white">LensLab</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Visualizer</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer",
                isActive 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="h-4 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-primary/20 border border-white/10">
              JS
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

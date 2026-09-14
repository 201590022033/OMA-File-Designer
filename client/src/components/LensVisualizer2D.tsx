import { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface LensVisualizer2DProps {
  data: any; // Parsed OMA data
  filename: string;
}

export function LensVisualizer2D({ data, filename }: LensVisualizer2DProps) {
  // Extract trace data for visualization
  const chartData = useMemo(() => {
    // Assuming parsedData.traces[0] exists and has R (radii) and A (angles)
    const trace = data?.traces?.[0];
    if (!trace || !trace.R || !trace.A) return [];

    return trace.R.map((radius: number, index: number) => ({
      angle: ((trace.A[index] * 180) / Math.PI).toFixed(0), // Convert to degrees if needed, usually traces are polar
      radius: radius,
      fullMark: 100 // Just for scaling axis if needed
    }));
  }, [data]);

  return (
    <Card className="h-full border-border/50 shadow-lg flex flex-col overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="w-2 h-6 bg-accent rounded-full"/>
          2D Trace Profile
        </CardTitle>
        <CardDescription className="font-mono text-xs truncate">
          {filename}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] p-0 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/5 pointer-events-none" />
        
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <PolarAngleAxis 
                dataKey="angle" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 'auto']} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                axisLine={false}
              />
              <Radar
                name="Radius"
                dataKey="radius"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No trace data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

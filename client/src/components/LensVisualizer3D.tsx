import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';
import { useProcessUpload } from '@/hooks/use-uploads';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LensVisualizer3DProps {
  uploadId: number;
}

function LensMesh({ geometryData }: { geometryData: any }) {
  const meshGeometry = useMemo(() => {
    if (!geometryData) return null;

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    // Parse faces to build indices
    // Backend returns faces like "f v1 v2 v3" where v are 1-based indices
    // AND vertices as array of objects {x,y,z}
    
    // Flatten vertices
    geometryData.vertices.forEach((v: any) => {
      vertices.push(v.x, v.y, v.z);
    });

    // Parse faces
    geometryData.faces.forEach((faceStr: string) => {
      const parts = faceStr.trim().split(/\s+/);
      if (parts[0] === 'f') {
        // Obj faces are 1-based, convert to 0-based
        const v1 = parseInt(parts[1]) - 1;
        const v2 = parseInt(parts[2]) - 1;
        const v3 = parseInt(parts[3]) - 1;
        indices.push(v1, v2, v3);
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }, [geometryData]);

  if (!meshGeometry) return null;

  return (
    <mesh geometry={meshGeometry}>
      <meshPhysicalMaterial 
        color="#88ccff" 
        transmission={0.9} // Glass-like
        opacity={1}
        metalness={0.1}
        roughness={0.05}
        ior={1.5}
        thickness={2.0}
        clearcoat={1}
      />
    </mesh>
  );
}

export function LensVisualizer3D({ uploadId }: LensVisualizer3DProps) {
  const [bevelType, setBevelType] = useState<string>('Standard Bevel');
  const [thickness, setThickness] = useState<number>(3.0);
  const { mutate: processGeometry, isPending, data: geometryResponse } = useProcessUpload(uploadId);

  // Auto-process on mount or when params change
  useEffect(() => {
    if (uploadId) {
      processGeometry({
        bevelType: bevelType as any,
        thickness
      });
    }
  }, [uploadId, bevelType, thickness, processGeometry]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Controls Bar */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-2 min-w-[180px]">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edge Finish</Label>
            <Select value={bevelType} onValueChange={setBevelType}>
              <SelectTrigger className="h-9 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard Bevel">Standard Bevel</SelectItem>
                <SelectItem value="Rimless Flat">Rimless Flat</SelectItem>
                <SelectItem value="Nylon Groove">Nylon Groove</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px] flex-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lens Thickness</Label>
              <Badge variant="outline" className="font-mono text-[10px] h-5">{thickness.toFixed(1)}mm</Badge>
            </div>
            <Slider 
              value={[thickness]} 
              min={1.0} 
              max={10.0} 
              step={0.1} 
              onValueChange={([val]) => setThickness(val)}
              className="py-1"
            />
          </div>

          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => processGeometry({ bevelType: bevelType as any, thickness })}
            disabled={isPending}
            className="ml-auto"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : null}
            Update Model
          </Button>
        </CardContent>
      </Card>

      {/* 3D Viewport */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-background to-muted relative shadow-inner">
        {isPending && !geometryResponse && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Generating Geometry...</p>
            </div>
          </div>
        )}
        
        <Canvas shadows camera={{ position: [0, 0, 100], fov: 45 }}>
          <Environment preset="warehouse" />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          
          <Stage environment={null} intensity={0.5}>
            {geometryResponse?.geometry && (
              <LensMesh geometryData={geometryResponse.geometry} />
            )}
          </Stage>
          
          <ContactShadows opacity={0.4} scale={20} blur={2} far={4.5} />
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
        </Canvas>

        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-muted-foreground/50 pointer-events-none">
          THREE.js Render Context
        </div>
      </div>
    </div>
  );
}

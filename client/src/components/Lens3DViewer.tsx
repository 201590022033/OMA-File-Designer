import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Center, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { generateLensMeshFromCartesian, type EdgeType, type BevelPlacement } from '@/lib/oma-parser';
import { parseCanonicalOma, traceToCartesian, binocularPlacement, fcrvForTrace } from '@shared/oma-engine';

export type TraceSelection = 'R' | 'L' | 'Both';

interface Lens3DViewerProps {
  omaContent: string;
  thickness: number;
  baseCurve: number;
  materialColor?: string;
  showWireframe?: boolean;
  traceSelection?: TraceSelection;
  debugOverlay?: boolean;
  edgeType?: EdgeType;
  bevelPlacement?: BevelPlacement;
  bevelPositionRatio?: number;
  grooveWidthMm?: number;
  grooveDepthMm?: number;
  groovePositionRatio?: number;
}

function LensMesh({ omaContent, thickness, baseCurve, materialColor = "#a5d8ff", showWireframe, edgeType = "v-bevel", bevelPositionRatio = 0.5, grooveWidthMm = 0.52, grooveDepthMm = 1.85, groovePositionRatio = 0.4, traceSelection = 'Both', position = [0, 0, 0] }: Lens3DViewerProps & { position?: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const file = parseCanonicalOma(omaContent);
    const trace = file.traces.find((candidate) => traceSelection === 'Both' || candidate.side === traceSelection) ?? file.traces[0];
    const outline = trace ? traceToCartesian(trace) : [];
    const optical = trace ? fcrvForTrace(file, trace) : { radius: Infinity };
    const { vertices, indices } = generateLensMeshFromCartesian(outline, thickness, baseCurve, optical.radius, edgeType, bevelPositionRatio, grooveWidthMm, grooveDepthMm, groovePositionRatio);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [omaContent, thickness, baseCurve, edgeType, bevelPositionRatio, grooveWidthMm, grooveDepthMm, groovePositionRatio, traceSelection]);

  // Rotate slowly
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial 
          color={materialColor}
          transmission={0.95} 
          opacity={1}
          metalness={0.1}
          roughness={0.1}
          ior={1.5}
          thickness={thickness}
          specularIntensity={1}
          clearcoat={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {showWireframe && (
         <mesh geometry={geometry}>
           <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
         </mesh>
      )}
    </group>
  );
}

export function Lens3DViewer(props: Lens3DViewerProps) {
  const selection = props.traceSelection ?? 'Both';
  const traces = parseCanonicalOma(props.omaContent).traces;
  const selectedTraces = selection === 'Both'
    ? traces.filter((trace) => trace.side === 'R' || trace.side === 'L')
    : traces.filter((trace) => trace.side === selection);
  const renderTraces = selectedTraces.length ? selectedTraces : traces.slice(0, 1);
  const placement = binocularPlacement(parseCanonicalOma(props.omaContent));
  return (
    <div className="w-full h-full min-h-[400px] bg-gradient-to-b from-gray-900 to-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
       {/* Background decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />
      
      <Canvas shadows camera={{ position: [0, 0, 100], fov: 45 }}>
        <fog attach="fog" args={['#050505', 10, 200]} />
        
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} minDistance={20} maxDistance={200} />
        
        <Environment preset="warehouse" />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[100, 100, 100]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <Center>
          {renderTraces.map((trace) => (
            <LensMesh key={`${trace.side}-${trace.index}`} {...props} traceSelection={trace.side === 'R' || trace.side === 'L' ? trace.side : selection} position={selection === 'Both' ? [trace.side === 'R' ? placement.rightX : placement.leftX, 0, 0] : [0, 0, 0]} />
          ))}
        </Center>
        
        <Grid 
          position={[0, -20, 0]} 
          args={[100, 100]} 
          cellSize={5} 
          cellThickness={1} 
          cellColor="#2563eb" 
          sectionSize={25} 
          sectionThickness={1.5} 
          sectionColor="#3b82f6" 
          fadeDistance={50} 
          fadeStrength={1.5} 
        />
      </Canvas>
      
      <div className="absolute bottom-4 right-4 text-xs text-white/30 font-mono pointer-events-none">
        RENDERER: WEBGL 2.0
      </div>
      {props.debugOverlay && (
        <div className="absolute top-4 right-4 rounded bg-black/70 p-3 text-[10px] font-mono text-white/80 pointer-events-none">
          <div>GLOBAL ORIGIN: 0, 0</div>
          <div>LOCAL R ORIGIN: {selection === 'Both' ? placement.rightX.toFixed(2) : '0.00'}, 0</div>
          <div>LOCAL L ORIGIN: {selection === 'Both' ? placement.leftX.toFixed(2) : '0.00'}, 0</div>
          <div>R/L: screen-left=L, screen-right=R</div>
          <div>DBL: {placement.dbl?.toFixed(2) ?? 'unknown'} mm</div>
          <div>CENTERS: {placement.centerDistance?.toFixed(2) ?? 'unknown'} mm</div>
          <div>AXES: X horizontal / Y vertical</div>
        </div>
      )}
    </div>
  );
}

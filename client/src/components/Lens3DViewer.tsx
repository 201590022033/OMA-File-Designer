import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Center, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { parseOmaContent, generateLensMesh } from '@/lib/oma-parser';

interface Lens3DViewerProps {
  omaContent: string;
  thickness: number;
  baseCurve: number;
  materialColor?: string;
  showWireframe?: boolean;
}

function LensMesh({ omaContent, thickness, baseCurve, materialColor = "#a5d8ff", showWireframe }: Lens3DViewerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const { rPoints, aPoints } = parseOmaContent(omaContent);
    const { vertices, indices } = generateLensMesh(rPoints, aPoints, thickness, baseCurve);
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [omaContent, thickness, baseCurve]);

  // Rotate slowly
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group>
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
          <LensMesh {...props} />
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
    </div>
  );
}

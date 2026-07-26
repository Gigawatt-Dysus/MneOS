import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, PerspectiveCamera, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const SynthesisCore = ({ isMobile = false }: { isMobile?: boolean }) => {
    const groupRef = useRef<THREE.Group>(null);
    const knotRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        if (groupRef.current) {
            groupRef.current.rotation.y = time * 0.15;
        }
        if (knotRef.current) {
            knotRef.current.rotation.z = time * 0.8;
            knotRef.current.rotation.x = time * 0.1;
        }
    });

    return (
        <Float speed={3} rotationIntensity={0.5} floatIntensity={0.5}>
            <group ref={groupRef}>
                {/* 1. THE NEURAL WORMHOLE (Primary Glass Core) */}
                <mesh ref={knotRef}>
                    <torusKnotGeometry args={[1.5, 0.35, isMobile ? 120 : 300, isMobile ? 24 : 40, 2, 3]} />
                    <MeshTransmissionMaterial
                        backside
                        samples={isMobile ? 8 : 64}
                        resolution={isMobile ? 256 : 2048}
                        thickness={0.8}
                        anisotropy={isMobile ? 0 : 0.5}
                        chromaticAberration={0.15}
                        distortion={0.3}
                        distortionScale={0.5}
                        temporalDistortion={0.1}
                        color="#004e89"
                        metalness={0.6}
                        roughness={0.0}
                        transmission={1}
                        ior={1.4}
                    />
                </mesh>

                {/* 2. GOLDEN RATIO WIREFRAME (The Technical Blueprint) */}
                <mesh ref={knotRef} scale={[1.02, 1.02, 1.02]}>
                    <torusKnotGeometry args={[1.5, 0.35, isMobile ? 200 : 600, isMobile ? 12 : 20]} />
                    <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.2} />
                </mesh>

                {/* 3. THE SINGULARITY CORE (Radiant Energy) */}
                <mesh>
                    <sphereGeometry args={[0.2, isMobile ? 16 : 32, isMobile ? 16 : 32]} />
                    <meshBasicMaterial color="#fff" />
                    <pointLight color="#00f0ff" intensity={isMobile ? 15 : 30} distance={10} decay={2} />
                    <pointLight position={[2, 2, 2]} color="#004e89" intensity={isMobile ? 5 : 10} />
                </mesh>

                {/* 4. TECHNICAL CONSTELLATIONS (Mathematical Atlas) */}
                <points rotation-y={Math.PI / 4}>
                    <torusKnotGeometry args={[2.5, 0.8, isMobile ? 400 : 1000, isMobile ? 16 : 32]} />
                    <pointsMaterial size={0.01} color="#00f0ff" transparent opacity={0.15} sizeAttenuation />
                </points>

                {/* 5. BLUEPRINT GRID PLANE */}
                <gridHelper args={[20, isMobile ? 30 : 60, "#00f0ff", "#004e89"]} position={[0, -2.5, 0]} rotation={[Math.PI / 8, 0, 0]} />
                
                {/* Mathematical Particles (Vector Flow) */}
                <Sparkles 
                    count={100} 
                    scale={5} 
                    size={2} 
                    speed={0.4} 
                    opacity={0.2} 
                    color="#00f0ff" 
                />
            </group>
        </Float>
    );
};

export const ExecutiveSynthesis3D: React.FC<{ isLobby?: boolean, glow?: boolean, isMobile?: boolean }> = ({ isLobby = false, glow = false, isMobile = false }) => {
    return (
        <div className={`w-full h-full relative transition-all duration-1000 ${isLobby ? 'scale-110' : ''}`}>
            <Canvas dpr={isMobile ? [1, 1.2] : [1, 2]} flat shadows>
                <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
                <ambientLight intensity={isLobby ? 0.3 : 0.5} />
                <pointLight position={[10, 10, 10]} color="#10b981" intensity={glow ? 5 : 1} />
                <pointLight position={[-10, -10, -10]} color="#06b6d4" intensity={glow ? 3 : 0.5} />
                <SynthesisCore isMobile={isMobile} />
            </Canvas>
            
            {!isLobby && (
                <div className="absolute inset-x-0 bottom-0 text-center pb-4">
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            <span className="text-xs font-mono text-cyan-400 uppercase tracking-[0.3em] font-black">Synthesizing Asynchronous Synchronicity</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest opacity-60">Architecting Executive ROI Briefing...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

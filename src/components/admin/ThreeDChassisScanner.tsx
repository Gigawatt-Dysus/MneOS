import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { GlassButton } from '../GlassButton';

interface ChassisParams {
    heightCm: number;
    heightScale: number;
    centerY: number;
    pivotOffset: number;
    materialMode: 'mesh' | 'wireframe';
    proportions?: { bust: number; waist: number; hips: number };
}

interface ThreeDChassisScannerProps {
    isOpen: boolean;
    onClose: () => void;
    chassisParams?: ChassisParams;
    modelName?: string;
}

const BodyModel: React.FC<{ params: ChassisParams }> = ({ params }) => {
    const groupRef = useRef<THREE.Group>(null!);
    const { heightScale, pivotOffset, materialMode } = params;

    const scale = heightScale || 1;
    const isWireframe = materialMode === 'wireframe';

    const material = isWireframe
        ? new THREE.MeshBasicMaterial({ color: 0x00e7ff, wireframe: true })
        : new THREE.MeshPhongMaterial({ color: 0x00e7ff, shininess: 25, transparent: true, opacity: 0.9 });

    useFrame(() => {
        if (groupRef.current) {
            // Shift the entire model group so its local origin is at the body center
            groupRef.current.position.y = pivotOffset;
        }
    });

    const height = 1.72; // base height

    return (
        <group ref={groupRef} scale={[scale, scale, scale]}>
            {/* Torso - centered at body center */}
            <mesh position={[0, 0, 0]} material={material}>
                <cylinderGeometry args={[0.32, 0.35, height * 0.48, 24]} />
            </mesh>

            {/* Head */}
            <mesh position={[0, 0.85, 0]} material={material}>
                <sphereGeometry args={[0.23]} />
            </mesh>

            {/* Left Leg */}
            <mesh position={[-0.14, -0.75, 0]} material={material}>
                <cylinderGeometry args={[0.1, 0.12, height * 0.52, 12]} />
            </mesh>
            {/* Right Leg */}
            <mesh position={[0.14, -0.75, 0]} material={material}>
                <cylinderGeometry args={[0.1, 0.12, height * 0.52, 12]} />
            </mesh>

            {/* Arms */}
            <mesh position={[-0.48, 0.1, 0]} rotation={[0, 0, 0.5]} material={material}>
                <cylinderGeometry args={[0.08, 0.1, height * 0.42, 10]} />
            </mesh>
            <mesh position={[0.48, 0.1, 0]} rotation={[0, 0, -0.5]} material={material}>
                <cylinderGeometry args={[0.08, 0.1, height * 0.42, 10]} />
            </mesh>
        </group>
    );
};

export const ThreeDChassisScanner: React.FC<ThreeDChassisScannerProps> = ({
    isOpen,
    onClose,
    chassisParams,
    modelName = "BRITA"
}) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [materialMode, setMaterialMode] = useState<'mesh' | 'wireframe'>(
        chassisParams?.materialMode || 'mesh'
    );

    if (!isOpen) return null;

    const params: ChassisParams = chassisParams || {
        heightCm: 172,
        heightScale: 1,
        centerY: 0,
        pivotOffset: -0.9,
        materialMode: 'mesh'
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
            <div className={`bg-[#0a0c12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 
                ${isMaximized ? 'w-full h-full' : 'w-[1180px] h-[760px]'}`}>
                
                <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40">
                    <div className="flex items-center gap-3">
                        <div className="text-cyan-400 text-xs tracking-[3px] font-mono">TELEMETRY VISUALIZATION SCANNER</div>
                        <div className="text-white/50 text-xs font-mono">{modelName} • DYSUS CONSTRUCT LAB v4.3</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <GlassButton onClick={() => setIsMaximized(!isMaximized)} variant="ghost" className="h-8 w-8 p-0">
                            {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </GlassButton>
                        <GlassButton onClick={onClose} variant="ghost" className="h-8 w-8 p-0">
                            <X size={17} />
                        </GlassButton>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* 3D View */}
                    <div className="flex-1 relative bg-[#05070a]">
                        <Canvas camera={{ position: [0, 1.6, 3.8], fov: 46 }}>
                            <ambientLight intensity={0.7} />
                            <pointLight position={[8, 12, -8]} intensity={1.4} color="#00f0ff" />
                            
                            <BodyModel params={{ ...params, materialMode }} />
                            
                            <OrbitControls 
                                enablePan={true}
                                enableZoom={true}
                                target={[0, params.centerY + params.pivotOffset + 0.3, 0]} 
                            />
                        </Canvas>
                        
                        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-cyan-400/60">
                            Pivot: Body Center • Scale: {params.heightScale.toFixed(2)}
                        </div>
                    </div>

                    {/* Right HUD */}
                    <div className="w-[360px] bg-[#0a0c12] border-l border-white/10 p-5 flex flex-col gap-5 text-sm overflow-y-auto">
                        <div>
                            <div className="text-cyan-400 text-xs tracking-[2px]">DYSUS CONSTRUCT LAB</div>
                            <div className="text-lg font-semibold text-white mt-0.5">CHASSIS DIAGNOSTICS</div>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs space-y-2">
                            <div className="flex justify-between"><span className="text-white/60">HEIGHT</span><span className="font-mono text-white">{params.heightCm} cm</span></div>
                            <div className="flex justify-between"><span className="text-white/60">PIVOT OFFSET</span><span className="font-mono text-white">{params.pivotOffset.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-white/60">MATERIAL</span><span className="font-mono text-white">{materialMode.toUpperCase()}</span></div>
                        </div>

                        <div className="mt-auto space-y-2">
                            <div className="flex gap-2">
                                <GlassButton 
                                    onClick={() => setMaterialMode('mesh')} 
                                    variant={materialMode === 'mesh' ? 'primary' : 'secondary'}
                                    className="flex-1 text-xs"
                                >
                                    SOLID MESH
                                </GlassButton>
                                <GlassButton 
                                    onClick={() => setMaterialMode('wireframe')} 
                                    variant={materialMode === 'wireframe' ? 'primary' : 'secondary'}
                                    className="flex-1 text-xs"
                                >
                                    WIREFRAME
                                </GlassButton>
                            </div>
                            
                            <GlassButton onClick={onClose} variant="secondary" className="w-full text-xs">
                                MINIMIZE DIAGNOSTICS
                            </GlassButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
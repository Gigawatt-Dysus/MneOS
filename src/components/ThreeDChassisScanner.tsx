import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations, Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, Minimize2, RotateCcw, Activity, Cpu, Sliders, Settings, Play, Pause
} from 'lucide-react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { httpsCallable } from '../services/apiClient';
import { SecretsManager } from '../utils/SecretsManager';

interface ThreeDChassisScannerProps {
  bodyMatrix: {
    height: string;
    weight: string;
    breastSize: string;
    eyeColor?: string;
    eyePlacement?: string;
    nosePlacement?: string;
    mouthPlacement?: string;
    jawline?: string;
    limbLength?: string;
    torsoLength?: string;
    headSize?: string;
    groolCapacity?: string;
    fluidCapacitance?: string;
    hairStyle?: string;
    hairLength?: string;
    chassisModelUrl?: string;
  };
  setBodyMatrix: (matrix: any) => void;
  onReset?: () => void;
  fashionGown: number;
  yOffset?: number;
}

// -------------------------------------------------------------
// THREE.JS GLTF WIREFRAME LOADER WITH DYNAMIC BONE DEFORMATION
// -------------------------------------------------------------
// -------------------------------------------------------------
// [ZEN SECURITY] WEBGL ERROR BOUNDARY FOR 3D CONSTRUCT RECONSTRUCTION
// -------------------------------------------------------------
class ThreeDErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ThreeDErrorBoundary] Caught 3D loading error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface ModelProps {
  height: string;
  weight: string;
  breastSize: string;
  color: string;
  opacity: number;
  renderMode: 'WIREFRAME' | 'SOLID';
  anthropometrics: {
    headSize: number;
    torsoLength: number;
    limbLength: number;
  };
  chassisModelUrl?: string;
  onPivotClick?: (point: THREE.Vector3) => void;
  yOffset?: number;
}

function HolodeckRoom() {
  return (
    <group>
      {/* Floor */}
      <gridHelper args={[20, 20, '#f59e0b', '#fbbf24']} position={[0, -1, 0]} />
      {/* Back Wall */}
      <gridHelper args={[20, 20, '#f59e0b', '#fbbf24']} position={[0, 9, -10]} rotation={[Math.PI / 2, 0, 0]} />
      {/* Left Wall */}
      <gridHelper args={[20, 20, '#f59e0b', '#fbbf24']} position={[-10, 9, 0]} rotation={[0, 0, Math.PI / 2]} />
      {/* Right Wall */}
      <gridHelper args={[20, 20, '#f59e0b', '#fbbf24']} position={[10, 9, 0]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  );
}

// Only load URLs that actually end in a 3D model extension.
// This prevents partial-typing crashes and stale bad URLs saved in Firebase.
function sanitizeChassisUrl(url?: string): string {
  const trimmed = (url || '').trim();
  if (/\.(glb|gltf)$/i.test(trimmed)) return trimmed;
  return '/Rio.glb'; // safe fallback
}

export function HumanWireframeModel({ height, weight, breastSize, color, opacity, renderMode, anthropometrics, chassisModelUrl, onPivotClick, yOffset }: ModelProps) {
  // Validate URL before touching useGLTF — bad URLs crash the WebGL context
  const safeUrl = sanitizeChassisUrl(chassisModelUrl);
  const { scene, animations } = useGLTF(safeUrl);
  
  // Clone scene to avoid mutating the shared GLTF cache and prevent WebGL context loss across Canvases
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  
  // Use raw Three.js AnimationMixer to bypass any drei hook bugs with cloned scenes
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  useEffect(() => {
    if (animations && animations.length > 0) {
      // Play all available animations to guarantee the right one plays (some may be T-Poses or empty)
      animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.reset().play();
      });
    }
    return () => {
      mixer.stopAllAction();
    };
  }, [animations, mixer]);

  useFrame((state, delta) => {
    mixer.update(delta);
  });

  // Parse biometric dimensions
  const heightVal = parseFloat(height) || 1.70;
  const weightVal = parseFloat(weight) || 60;
  const heightScale = heightVal / 1.70;
  const widthScale = Math.sqrt(weightVal / 60);

  // Breast size mapping
  const breastSizes = ['32A', '32B', '34C', '34D', '36DD', '38F', '40H', '42J'];
  const breastIdx = breastSizes.indexOf(breastSize);
  const breastScaleFactor = 1.0 + (breastIdx !== -1 ? breastIdx : 2) * 0.08;

  // Apply materials and bone scaling
  useEffect(() => {
    const headScale = 0.8 + (anthropometrics.headSize / 100) * 0.4;
    const torsoScale = 0.8 + (anthropometrics.torsoLength / 100) * 0.4;
    const limbScale = 0.8 + (anthropometrics.limbLength / 100) * 0.4;

    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        // Only style SkinnedMesh nodes (actual character geometry).
        // Plain Mesh nodes are Blender helper objects — hide them.
        if (!child.isSkinnedMesh) {
          child.visible = false;
          return;
        }
        if (renderMode === 'WIREFRAME') {
          child.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            wireframe: true,
            transparent: true,
            opacity: opacity,
            depthWrite: false,
            side: THREE.DoubleSide
          });
        } else {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#334155'),
            roughness: 0.6,
            metalness: 0.2,
            transparent: false,
            opacity: 1,
            depthWrite: true,
            side: THREE.FrontSide
          });
        }
      }
      if (child.isBone) {
        const name = child.name.toLowerCase();
        const orig = scene.getObjectByName(child.name);
        if (orig) {
          child.scale.copy(orig.scale);
          if (name.includes('spine2') || name.includes('chest')) {
            child.scale.x *= breastScaleFactor;
            child.scale.z *= breastScaleFactor;
          }
          if (name.includes('head')) {
            child.scale.multiplyScalar(headScale);
          }
          if (name.includes('spine')) {
            child.scale.y *= torsoScale;
          }
          if (name.includes('arm') || name.includes('leg') || name.includes('thigh') || name.includes('calf') || name.includes('hand') || name.includes('foot')) {
            child.scale.y *= limbScale;
          }
        }
      }
    });
  }, [scene, color, opacity, breastScaleFactor, renderMode, anthropometrics]);

  // Manual Y-offset from the debug slider
  const manualOffset = yOffset !== undefined ? yOffset : 0;

  // NOTE: We do NOT compute or apply a normScale here.
  // The parent <Bounds fit clip observe> component auto-fits the camera
  // after the scene renders, handling any GLB unit scale automatically.
  // We only apply the biometric proportional scales.
  // 
  // Floor placement: Blender confirms the model origin is at the feet (0,0,0).
  // The Holodeck floor grid lives at y=-1, so we place the group there.
  return (
    <group
      scale={[widthScale, heightScale, widthScale]}
      position={[0, -1 + manualOffset, 0]}
    >
      <primitive
        object={clonedScene}
        onPointerDown={(e: any) => {
          e.stopPropagation();
          if (onPivotClick) onPivotClick(e.point);
        }}
      />
    </group>
  );
}

// -------------------------------------------------------------
// PIVOT GIZMO & SMOOTH CAMERA UPDATER
// -------------------------------------------------------------
function PivotGizmo({ position }: { position: THREE.Vector3 }) {
  const gizmoRef = useRef<THREE.Group>(null);
  
  const axes = useMemo(() => {
    const group = new THREE.Group();
    group.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 0.3, 0xff0000));
    group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0.3, 0x00ff00));
    group.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 0.3, 0x0000ff));
    return group;
  }, []);

  return (
    <group position={position} ref={gizmoRef}>
      <primitive object={axes} />
      {/* Center ring/sphere */}
      <mesh>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthTest={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.04, 0.05, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </group>
  );
}

function SmoothPivotUpdater({ target, controlsRef }: { target: THREE.Vector3 | null, controlsRef: any }) {
  useFrame(() => {
    if (!controlsRef.current) return;
    const currentTarget = controlsRef.current.target as THREE.Vector3;
    if (target) {
      currentTarget.lerp(target, 0.1);
    } else {
      currentTarget.lerp(new THREE.Vector3(0, 0, 0), 0.1);
    }
    controlsRef.current.update();
  });
  return null;
}


// -------------------------------------------------------------
// INTERACTIVE AUTO-SPIN R3F SCENE CONTAINER
// -------------------------------------------------------------
function RotatingModelContainer({ autoSpin, children }: { autoSpin: boolean; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (autoSpin && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

// Fallback skeleton loader indicator
function TelemetryLoader() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[0.5, 1.5, 0.5]} />
      <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.15} />
    </mesh>
  );
}

// -------------------------------------------------------------
// MAIN CHASSIS SCANNER IMPLEMENTATION (INLINE + PORTAL DIALOG)
// -------------------------------------------------------------
export const ThreeDChassisScanner: React.FC<ThreeDChassisScannerProps> = ({ 
  bodyMatrix, 
  setBodyMatrix,
  onReset,
  fashionGown
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [manualYOffset, setManualYOffset] = useState(0.0);
  const [wireframeColor, setWireframeColor] = useState<string>('#06b6d4'); // Default cyber cyan
  const [autoSpin, setAutoSpin] = useState(true);
  const [wireframeOpacity, setWireframeOpacity] = useState(0.35);
  const [useImperial, setUseImperial] = useState(false);
  const [renderMode, setRenderMode] = useState<'WIREFRAME' | 'SOLID'>('WIREFRAME');
  const [pivotTarget, setPivotTarget] = useState<THREE.Vector3 | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Conversion Helpers
  const formatHeight = (meters: string | number) => {
    const m = typeof meters === 'string' ? parseFloat(meters) : meters;
    if (isNaN(m)) return '0m';
    if (!useImperial) return `${m.toFixed(2)}m`;
    const totalInches = Math.round(m * 39.3701);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };
  
  const formatWeight = (kg: string | number) => {
    const k = typeof kg === 'string' ? parseFloat(kg) : kg;
    if (isNaN(k)) return '0kg';
    if (!useImperial) return `${k.toFixed(0)}kg`;
    return `${Math.round(k * 2.20462)}lbs`;
  };

  const handleHeightSlider = (val: string) => {
    if (useImperial) {
      const inches = parseInt(val, 10);
      handleSliderChange('height', (inches / 39.3701).toFixed(2));
    } else {
      handleSliderChange('height', val);
    }
  };

  const handleWeightSlider = (val: string) => {
    if (useImperial) {
      const lbs = parseInt(val, 10);
      handleSliderChange('weight', (lbs / 2.20462).toFixed(0));
    } else {
      handleSliderChange('weight', val);
    }
  };
  
  // Ref for OrbitControls to allow manual resets
  const controlsRef = useRef<any>(null);

  const resetCamera = () => {
    setPivotTarget(null);
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleSliderChange = (field: string, value: string) => {
    setBodyMatrix({
      ...bodyMatrix,
      [field]: value
    });
  };  // --- Mesh Pipeline Handlers ---
  const handleRiggedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[MeshPipeline] handleRiggedUpload triggered!");
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("[MeshPipeline] Rigged file selected:", file.name, "Size:", file.size);
    
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to upload models.");
      return;
    }

    const storage = getStorage();
    const fileExt = file.name.split('.').pop() || 'glb';
    const storageRef = ref(storage, `users/${user.uid}/chassis/custom_mesh_${Date.now()}.${fileExt}`);

    console.log("[MeshPipeline] Starting upload to Firebase Storage...");
    setUploadProgress(0);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`[MeshPipeline] Upload is ${progress.toFixed(2)}% done`);
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("[MeshPipeline] Upload failed:", error);
        setUploadProgress(null);
        alert("Upload failed. Check console.");
        e.target.value = ''; // Reset on error
      }, 
      async () => {
        console.log("[MeshPipeline] Upload complete! Getting download URL...");
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        console.log("[MeshPipeline] Download URL obtained:", downloadURL);
        handleSliderChange('chassisModelUrl', downloadURL);
        setUploadProgress(null);
        e.target.value = ''; // Reset on success
      }
    );
  };

  const handleGenerateMesh = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[MeshPipeline] handleGenerateMesh triggered!");
    const file = e.target.files?.[0];
    if (!file) {
      console.warn("[MeshPipeline] No file selected.");
      return;
    }
    console.log("[MeshPipeline] File selected:", file.name);

    const replicateKey = SecretsManager.get('replicate');
    if (!replicateKey) {
      console.error("[MeshPipeline] Missing Replicate API Key.");
      alert("Missing Replicate API Key. Please inject via console first.");
      e.target.value = '';
      return;
    }

    console.log("[MeshPipeline] Replicate key found, starting generation...");
    setIsGenerating(true);
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const functions = getFunctions();
      const proxyReplicateMesh = httpsCallable(functions, 'proxyReplicateMesh');
      const result = await proxyReplicateMesh({
        imageBase64: base64Data,
        replicateKey: replicateKey,
        modelId: "firtoz/trellis"
      });

      const data = result.data as any;
      if (data?.status === 'success' && data.output) {
        let downloadUrl = '';
        if (typeof data.output === 'string') downloadUrl = data.output;
        else if (data.output?.model_file) downloadUrl = data.output.model_file;
        else if (Array.isArray(data.output)) downloadUrl = data.output[0];
        else if (data.output?.mesh) downloadUrl = data.output.mesh;
        else downloadUrl = Object.values(data.output)[0] as string;
        
        console.log("[MeshPipeline] Downloading mesh from:", downloadUrl);
        if (data.output?.color_video) {
          console.log("[MeshPipeline] Texture verification video URL:", data.output.color_video);
        }

        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `trellis_unrigged_${Date.now()}.glb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } else {
        throw new Error(data?.error || "Unknown error from Replicate proxy");
      }
    } catch (err: any) {
      console.error("[MeshPipeline] Generation failed:", err);
      alert("Generation failed: " + err.message);
    } finally {
      setIsGenerating(false);
      e.target.value = '';
    }
  };

  // Generate dynamic premium slider style block based on current color theme
  const sliderThemeId = wireframeColor.replace('#', '');
  const dynamicSliderStyle = `
    .premium-slider-${sliderThemeId} {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      outline: none;
    }
    .premium-slider-${sliderThemeId}::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${wireframeColor};
      box-shadow: 0 0 8px ${wireframeColor};
      cursor: pointer;
      transition: transform 0.15s ease-in-out;
    }
    .premium-slider-${sliderThemeId}::-webkit-slider-thumb:hover {
      transform: scale(1.3);
    }
    .premium-slider-${sliderThemeId}::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${wireframeColor};
      border: none;
      box-shadow: 0 0 8px ${wireframeColor};
      cursor: pointer;
      transition: transform 0.15s ease-in-out;
    }
    .premium-slider-${sliderThemeId}::-moz-range-thumb:hover {
      transform: scale(1.3);
    }
  `;

  return (
    <>
      <style>{dynamicSliderStyle}</style>

      {/* -------------------------------------------------------------
          1. INLINE PREVIEW VIEWPORT
          ------------------------------------------------------------- */}
      <div 
        className="w-[125px] h-[185px] bg-slate-950/90 border border-cyan-500/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shrink-0 shadow-lg shadow-black/80 select-none"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.08),transparent)] pointer-events-none" />
        
        <div className="absolute top-2 left-2 text-[6px] font-black text-cyan-500/60 font-mono tracking-widest uppercase pointer-events-none">
          CHASSIS PROTOTYPE
        </div>

        {/* Small R3F Canvas Viewport - Centered Camera */}
        <div className="w-full h-full pt-4">
          {!isMaximized ? (
            <ThreeDErrorBoundary fallback={
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 font-mono text-center select-none bg-red-950/20 border border-red-500/20 rounded-2xl">
                <Activity className="w-5 h-5 text-red-500 animate-pulse" />
                <span className="text-[7px] text-red-400 font-black tracking-widest uppercase">CONSTRUCT ERROR</span>
                <button 
                  onClick={() => {
                    setBodyMatrix({ ...bodyMatrix, chassisModelUrl: '/Rio.glb' });
                  }}
                  className="px-2 py-0.5 border border-red-500/30 text-red-400 text-[6px] font-black rounded hover:bg-red-500/20 transition-all uppercase cursor-pointer"
                >
                  RESET CHASSIS
                </button>
              </div>
            }>
            <Canvas camera={{ position: [0, 0, 3.2], fov: 50 }}>
              <Suspense fallback={<TelemetryLoader />}>
                <ambientLight intensity={0.4} />
                <RotatingModelContainer autoSpin={autoSpin}>
                  <HolodeckRoom />
                  <HumanWireframeModel 
                    height={bodyMatrix.height}
                    weight={bodyMatrix.weight}
                    breastSize={bodyMatrix.breastSize}
                    color={wireframeColor}
                    opacity={wireframeOpacity}
                    renderMode={renderMode}
                    anthropometrics={{
                      headSize: parseInt(bodyMatrix.headSize || '50'),
                      torsoLength: parseInt(bodyMatrix.torsoLength || '50'),
                      limbLength: parseInt(bodyMatrix.limbLength || '50')
                    }}
                    chassisModelUrl={bodyMatrix.chassisModelUrl}
                    onPivotClick={setPivotTarget}
                    yOffset={manualYOffset}
                  />
                  {pivotTarget && <PivotGizmo position={pivotTarget} />}
                </RotatingModelContainer>
                <SmoothPivotUpdater target={pivotTarget} controlsRef={controlsRef} />
                <OrbitControls 
                  ref={controlsRef}
                  enableZoom={true} 
                  enablePan={false}
                  minDistance={1.5}
                  maxDistance={500}
                  target={[0, -0.14, 0]}
                  makeDefault
                />
              </Suspense>
            </Canvas>
            </ThreeDErrorBoundary>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-4 select-none font-mono text-center">
              <Activity className="w-6 h-6 text-cyan-500 animate-pulse" />
              <span className="text-[8px] text-cyan-400 font-black tracking-widest uppercase">DIAGNOSTICS LAB</span>
              <span className="text-[6px] text-slate-500 font-bold uppercase">MAXIMIZED VIEW</span>
            </div>
          )}
        </div>

        {/* Maximize Button to Pop Out Modal - Placed after Canvas to sit on top of the DOM stacking context */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log("Enlarge Chassis Scanner clicked, setting isMaximized to true.");
            setIsMaximized(true);
          }}
          className="absolute top-2 right-2 p-1.5 bg-slate-900/90 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 hover:text-white transition-all z-[50] shadow-md cursor-pointer"
          title="Open Large Diagnostics Lab"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Stats overlay bottom left */}
        <div className="absolute bottom-2 left-2 text-[5px] font-mono text-cyan-700/80 pointer-events-none uppercase">
          GLB LOADED | {bodyMatrix.height}M | {bodyMatrix.weight}KG
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. PORTAL DIAGNOSTICS LAB OVERLAY MODAL (FULL SCREEN)
          ------------------------------------------------------------- */}
      {createPortal(
        <AnimatePresence>
          {isMaximized && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
              {/* Backdrop Dismiss clickout */}
              <div 
                className="absolute inset-0 cursor-default" 
                onClick={() => setIsMaximized(false)} 
              />

              <motion.div 
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="relative bg-[#020617] border border-cyan-500/30 rounded-3xl shadow-[0_0_90px_rgba(6,182,212,0.25)] w-full max-w-5xl h-[85vh] flex overflow-hidden text-left"
              >
                {/* LEFT VIEWPORT COLUMN */}
                <div className="flex-1 relative flex flex-col bg-slate-950/30">
                  <div className="absolute top-4 left-6 z-10 space-y-1">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span className="text-[10px] font-black text-cyan-400 tracking-[0.2em] font-mono uppercase">
                        TELEMETRY VISUALIZATION SCANNER
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest">
                    MODEL ID: {(bodyMatrix.chassisModelUrl || '/Rio.glb').split('/').pop()?.toUpperCase()} | POLYGONAL WIREFRAME PROJECTION
                  </div>
                  </div>

                  {/* Floating Quick Camera Controls inside viewport */}
                  <div className="absolute bottom-4 left-6 z-10 flex items-center gap-2">
                    <button 
                      onClick={resetCamera}
                      className="h-7 px-2.5 rounded bg-slate-900/80 hover:bg-cyan-500/20 border border-cyan-500/30 text-[9px] text-cyan-400 font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-md"
                      title="Recenter 3D view camera"
                    >
                      <RotateCcw className="w-3 h-3" /> RESET CAMERA
                    </button>
                    <button 
                      onClick={() => setAutoSpin(!autoSpin)}
                      className={`h-7 px-2.5 rounded border text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-md ${
                        autoSpin 
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20' 
                          : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {autoSpin ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {autoSpin ? 'PAUSE ROTATION' : 'AUTO SPIN'}
                    </button>
                  </div>

                  {/* Large Canvas Area - Zoomed Camera, Centered Framing */}
                  <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06),transparent)] pointer-events-none" />
                    <ThreeDErrorBoundary fallback={
                      <div className="flex-1 w-full h-full flex flex-col items-center justify-center gap-3 p-8 font-mono text-center select-none bg-red-950/10 border border-red-500/20 rounded-2xl">
                        <Cpu className="w-10 h-10 text-red-500 animate-bounce" />
                        <span className="text-[12px] text-red-400 font-black tracking-[0.2em] uppercase">
                          3D RENDERING PIPELINE SUSPENDED
                        </span>
                        <p className="text-[9px] text-slate-500 max-w-sm uppercase leading-relaxed">
                          CRITICAL RESOURCE PATH FAULT (404 / WebGL Context Lost). The active chassis model GLB could not be retrieved from the host server.
                        </p>
                        <button 
                          onClick={() => {
                            setBodyMatrix({ ...bodyMatrix, chassisModelUrl: '/Rio.glb' });
                          }}
                          className="h-8 px-4 border border-red-500/30 text-red-400 text-[9px] font-black rounded bg-red-500/5 hover:bg-red-500/20 transition-all uppercase tracking-wider cursor-pointer"
                        >
                          FORCE RESTORE DEFAULT CHASSIS (/Rio.glb)
                        </button>
                      </div>
                    }>
                    <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }}>
                      <Suspense fallback={<TelemetryLoader />}>
                        <ambientLight intensity={0.4} />
                        <RotatingModelContainer autoSpin={autoSpin}>
                          <HolodeckRoom />
                          <HumanWireframeModel 
                            height={bodyMatrix.height}
                            weight={bodyMatrix.weight}
                            breastSize={bodyMatrix.breastSize}
                            color={wireframeColor}
                            opacity={wireframeOpacity}
                            renderMode={renderMode}
                            anthropometrics={{
                              headSize: parseInt(bodyMatrix.headSize || '50'),
                              torsoLength: parseInt(bodyMatrix.torsoLength || '50'),
                              limbLength: parseInt(bodyMatrix.limbLength || '50')
                            }}
                            chassisModelUrl={bodyMatrix.chassisModelUrl}
                            onPivotClick={setPivotTarget}
                            yOffset={manualYOffset}
                          />
                          {pivotTarget && <PivotGizmo position={pivotTarget} />}
                        </RotatingModelContainer>
                        <SmoothPivotUpdater target={pivotTarget} controlsRef={controlsRef} />
                        <OrbitControls 
                          ref={controlsRef}
                          enableZoom={true} 
                          enablePan={true}
                          minDistance={1.0}
                          maxDistance={500}
                          target={[0, -0.14, 0]}
                          makeDefault
                        />
                      </Suspense>
                    </Canvas>
                    </ThreeDErrorBoundary>
                  </div>
                </div>

                {/* RIGHT TRANSPARENT DIAGNOSTICS HUD PANEL */}
                <div className="w-[360px] border-l border-white/5 bg-slate-950/70 p-6 flex flex-col justify-between overflow-y-auto shrink-0 font-mono text-slate-200">
                  <div className="space-y-6">
                    {/* Title Header */}
                    <div className="border-b border-white/5 pb-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-[11px] font-black text-cyan-400 tracking-wider">DYSUS CONSTRUCT LAB</h4>
                        <p className="text-[8px] text-slate-500">CHASSIS DIAGNOSTICS DECK v4.3</p>
                      </div>
                      {/* Revert Button & Connection Badge */}
                      <div className="flex items-center gap-3">
                        {onReset && (
                          <button 
                            onClick={onReset}
                            className="px-3 py-1 border border-pink-500/30 text-pink-400 text-[9px] font-black tracking-widest rounded bg-pink-500/5 hover:bg-pink-500/20 transition-all uppercase"
                          >
                            REVERT
                          </button>
                        )}
                        <div className="px-3 py-1 border border-teal-500/30 text-teal-400 text-[9px] font-black tracking-widest rounded bg-teal-500/5 shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                          CONNECTED
                        </div>
                      </div>
                    </div>

                    {/* Readout stats */}
                    <div className="bg-slate-900/50 p-4 border border-white/5 rounded-2xl space-y-2">
                      <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block">
                        BIOMETRIC TELEMETRY
                      </span>
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[9px]">
                        <span className="text-slate-500">HEIGHT OUT:</span>
                        <span className="text-white text-right">{formatHeight(bodyMatrix.height)}</span>
                        <span className="text-slate-500">MASS INDEX:</span>
                        <span className="text-white text-right">{formatWeight(bodyMatrix.weight)}</span>
                        <span className="text-slate-500">BREAST RATIO:</span>
                        <span className="text-white text-right">{bodyMatrix.breastSize}</span>
                        <span className="text-slate-500">FLUID CAP:</span>
                        <span className="text-white text-right">{bodyMatrix.fluidCapacitance || '85%'}</span>
                        <span className="text-slate-500">GROOL CAP:</span>
                        <span className="text-white text-right">{bodyMatrix.groolCapacity || '75L'}</span>
                        <span className="text-slate-500">FASHION GOWN:</span>
                        <span className="text-white text-right">{fashionGown}%</span>
                      </div>
                    </div>

                    {/* BIOMETRIC SLIDERS */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1">
                        <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block">
                          BIOMETRIC CONTROLS
                        </span>
                        <button onClick={() => setUseImperial(!useImperial)} className="px-1.5 py-0.5 bg-slate-900 border border-white/10 rounded text-[7px] text-cyan-400 uppercase tracking-widest hover:bg-slate-800 transition-colors cursor-pointer">
                          {useImperial ? 'IMPERIAL' : 'METRIC'}
                        </button>
                      </div>

                      {/* Height Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-slate-400 uppercase">HEIGHT</span>
                          <span className="text-cyan-400">{formatHeight(bodyMatrix.height)}</span>
                        </div>
                        <input 
                          type="range" 
                          min={useImperial ? "57" : "1.45"} 
                          max={useImperial ? "83" : "2.10"} 
                          step={useImperial ? "1" : "0.01"}
                          value={useImperial ? Math.round(parseFloat(bodyMatrix.height) * 39.3701) : bodyMatrix.height}
                          onChange={(e) => handleHeightSlider(e.target.value)}
                          className={`premium-slider-${sliderThemeId}`}
                        />
                      </div>

                      {/* Weight Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-slate-400 uppercase">WEIGHT</span>
                          <span className="text-cyan-400 font-bold tracking-widest">{formatWeight(bodyMatrix.weight)}</span>
                        </div>
                        <input 
                          type="range" 
                          min={useImperial ? "93" : "42"} 
                          max={useImperial ? "243" : "110"} 
                          step="1"
                          value={useImperial ? Math.round(parseFloat(bodyMatrix.weight) * 2.20462) : bodyMatrix.weight}
                          onChange={(e) => handleWeightSlider(e.target.value)}
                          className={`premium-slider-${sliderThemeId}`}
                        />
                      </div>
                      
                      {/* Breast Size Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">BREAST SIZE MATRIX</label>
                        <select 
                          value={bodyMatrix.breastSize} 
                          onChange={(e) => handleSliderChange('breastSize', e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded px-2.5 py-1.5 text-[10px] text-white font-mono outline-none focus:border-cyan-400/40"
                        >
                          <option value="32A">Cup size A (32A)</option>
                          <option value="32B">Cup size B (32B)</option>
                          <option value="34C">Cup size C (34C)</option>
                          <option value="34D">Cup size D (34D)</option>
                          <option value="36DD">Cup size DD (36DD)</option>
                          <option value="38F">Cup size F (38F)</option>
                          <option value="40H">Cup size H (40H)</option>
                          <option value="42J">Cup size J (42J)</option>
                        </select>
                      </div>

                      {/* HAIR STYLING MODULE */}
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block">
                          CRANIAL FOLLICLE MATRIX
                        </span>
                        
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">HAIR STYLE</label>
                          <select 
                            value={bodyMatrix.hairStyle || 'Bob'} 
                            onChange={(e) => handleSliderChange('hairStyle', e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400/40"
                          >
                            <option value="Bald">Bald / Clean Shaven</option>
                            <option value="Buzz">Buzz Cut</option>
                            <option value="Bob">Bob Cut</option>
                            <option value="Mohawk">Mohawk</option>
                            <option value="Mullet">Mullet</option>
                            <option value="Long">Long & Flowing</option>
                            <option value="Ponytail">Ponytail</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px]">
                            <span className="text-slate-400 uppercase">HAIR LENGTH</span>
                            <span className="text-cyan-400">{bodyMatrix.hairLength || '50'}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" max="100" step="1"
                            value={bodyMatrix.hairLength || '50'} 
                            onChange={(e) => handleSliderChange('hairLength', e.target.value)}
                            className={`premium-slider-${sliderThemeId}`}
                          />
                        </div>
                      </div>

                      {/* Telemetry Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">GROOL CAPACITY</label>
                          <input 
                            type="text" 
                            value={bodyMatrix.groolCapacity || ''} 
                            onChange={(e) => handleSliderChange('groolCapacity', e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-[9px] text-white font-mono outline-none focus:border-cyan-400/40"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">FLUID CAP</label>
                          <input 
                            type="text" 
                            value={bodyMatrix.fluidCapacitance || ''} 
                            onChange={(e) => handleSliderChange('fluidCapacitance', e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-[9px] text-white font-mono outline-none focus:border-cyan-400/40"
                          />
                        </div>
                      </div>

                      {/* FACIAL TOPOLOGY */}
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block">
                          FACIAL TOPOLOGY
                        </span>
                        {['eyePlacement', 'nosePlacement', 'mouthPlacement', 'jawline'].map((field) => (
                          <div key={field} className="space-y-1.5">
                            <div className="flex justify-between text-[9px]">
                              <span className="text-slate-400 uppercase">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="text-cyan-400">{bodyMatrix[field as keyof typeof bodyMatrix] || '50'}</span>
                            </div>
                            <input 
                              type="range" min="0" max="100"
                              value={parseInt((bodyMatrix[field as keyof typeof bodyMatrix] as string) || '50')}
                              onChange={(e) => handleSliderChange(field, e.target.value)}
                              className={`premium-slider-${sliderThemeId}`}
                            />
                          </div>
                        ))}
                      </div>

                      {/* ANTHROPOMETRIC DATA */}
                      <div className="space-y-3 pt-3 border-t border-white/5">
                        <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block">
                          ANTHROPOMETRIC DATA
                        </span>
                        {['headSize', 'torsoLength', 'limbLength'].map((field) => (
                          <div key={field} className="space-y-1.5">
                            <div className="flex justify-between text-[9px]">
                              <span className="text-slate-400 uppercase">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="text-cyan-400">{bodyMatrix[field as keyof typeof bodyMatrix] || '50'}</span>
                            </div>
                            <input 
                              type="range" min="0" max="100"
                              value={parseInt((bodyMatrix[field as keyof typeof bodyMatrix] as string) || '50')}
                              onChange={(e) => handleSliderChange(field, e.target.value)}
                              className={`premium-slider-${sliderThemeId}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* IMAGE-TO-3D PIPELINE */}
                    <div className="space-y-1.5 pt-3 border-t border-white/5 pb-2">
                      <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block border-b border-white/5 pb-1">
                        IMAGE-TO-3D PIPELINE
                      </span>
                      <div className="flex gap-2 pt-1">
                        <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleGenerateMesh} />
                        <input type="file" accept=".glb,.gltf" className="hidden" ref={fileInputRef} onChange={handleRiggedUpload} />
                        <button 
                          onClick={() => imageInputRef.current?.click()}
                          disabled={isGenerating}
                          className="flex-1 py-2 rounded text-[9px] font-black uppercase tracking-wider border border-white/10 text-white/50 hover:bg-white/5 transition-all disabled:opacity-50"
                        >
                          {isGenerating ? 'GENERATING...' : '⚙ GENERATE (RAW)'}
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-2 rounded text-[9px] font-black uppercase tracking-wider border border-white/10 text-white/50 hover:bg-white/5 transition-all"
                        >
                          {uploadProgress !== null ? `UPLOADING ${Math.round(uploadProgress)}%` : '↑ IMPORT RIGGED'}
                        </button>
                      </div>
                    </div>

                    {/* RENDER CONTROLS */}
                    <div className="space-y-4 pt-3 border-t border-white/5">
                      <span className="text-[8px] font-black text-cyan-500/60 uppercase tracking-wider block border-b border-white/5 pb-1">
                        CHASSIS SHADER PARAMS
                      </span>

                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">RENDER MODE</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRenderMode('WIREFRAME')}
                            className="flex-1 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all"
                            style={{
                              borderColor: renderMode === 'WIREFRAME' ? wireframeColor : 'rgba(255,255,255,0.1)',
                              color: renderMode === 'WIREFRAME' ? wireframeColor : '#64748b',
                              backgroundColor: renderMode === 'WIREFRAME' ? `${wireframeColor}1a` : 'transparent'
                            }}
                          >
                            WIREFRAME
                          </button>
                          <button
                            onClick={() => setRenderMode('SOLID')}
                            className="flex-1 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all"
                            style={{
                              borderColor: renderMode === 'SOLID' ? wireframeColor : 'rgba(255,255,255,0.1)',
                              color: renderMode === 'SOLID' ? wireframeColor : '#64748b',
                              backgroundColor: renderMode === 'SOLID' ? `${wireframeColor}1a` : 'transparent'
                            }}
                          >
                            SOLID (BLOCKOUT)
                          </button>
                        </div>
                      </div>

                      {/* Color palette selections */}
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">HUD GLOW THEME</label>
                        <div className="flex gap-2">
                          {[
                            { name: 'Cyan', color: '#22d3ee' },
                            { name: 'Green', color: '#22c55e' },
                            { name: 'Amber', color: '#fbbf24' },
                            { name: 'Red', color: '#ef4444' }
                          ].map((theme) => (
                            <button
                              key={theme.name}
                              onClick={() => setWireframeColor(theme.color)}
                              className="flex-1 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all"
                              style={{
                                borderColor: wireframeColor === theme.color ? theme.color : 'rgba(255,255,255,0.1)',
                                color: wireframeColor === theme.color ? theme.color : '#64748b',
                                backgroundColor: wireframeColor === theme.color ? `${theme.color}0d` : 'transparent'
                              }}
                            >
                              {theme.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Opacity slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-slate-400 uppercase">WIREFRAME OPACITY</span>
                          <span className="text-cyan-400">{Math.round(wireframeOpacity * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.15" max="0.80" step="0.05"
                          value={wireframeOpacity}
                          onChange={(e) => setWireframeOpacity(parseFloat(e.target.value))}
                          className={`premium-slider-${sliderThemeId}`}
                        />
                      </div>

                      {/* Height Grounding / Vertical Offset Adjustment Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-slate-400 uppercase">MODEL GROUNDING Y-OFFSET</span>
                          <span className="text-cyan-400">{manualYOffset.toFixed(2)}m</span>
                        </div>
                        <input 
                          type="range" min="-1.50" max="1.50" step="0.05"
                          value={manualYOffset}
                          onChange={(e) => setManualYOffset(parseFloat(e.target.value))}
                          className={`premium-slider-${sliderThemeId}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Controls */}
                  <div className="pt-4 border-t border-white/5 flex gap-3 shrink-0">
                    <button
                      onClick={() => setIsMaximized(false)}
                      className="flex-1 h-9 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Minimize2 className="w-3.5 h-3.5" /> MINIMIZE DIAGNOSTICS
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};



import React, { useRef, useEffect, useCallback } from 'react';
import { SimplexNoise } from '../utils/simplex';

interface VortexProps {
  particleCount?: number;
  rangeY?: number;
  baseHue?: number;
  rangeHue?: number;
  baseSpeed?: number;
  rangeSpeed?: number;
  baseRadius?: number;
  rangeRadius?: number;
  backgroundColor?: string;
  className?: string;
  children?: React.ReactNode;
}

export const Vortex: React.FC<VortexProps> = ({
  particleCount = 700,
  baseHue = 220,
  rangeHue = 100,
  baseSpeed = 0.0,
  rangeSpeed = 1.5,
  baseRadius = 1,
  rangeRadius = 2,
  backgroundColor = "#000000",
  className,
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simplex = useRef<SimplexNoise | null>(null);

  const createParticles = useCallback((canvas: HTMLCanvasElement) => {
    return Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: 0,
      vy: 0,
      hue: baseHue + Math.random() * rangeHue,
      speed: baseSpeed + Math.random() * rangeSpeed,
      radius: baseRadius + Math.random() * rangeRadius,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }, [particleCount, baseHue, rangeHue, baseSpeed, rangeSpeed, baseRadius, rangeRadius]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    simplex.current = new SimplexNoise();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.offsetWidth;
        canvas.height = containerRef.current.offsetHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    let particles = createParticles(canvas);
    let animationFrameId: number;

    const tick = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        const noiseX = simplex.current!.noise3D(p.x * 0.002, p.y * 0.002, time * 0.0001);
        const noiseY = simplex.current!.noise3D(p.x * 0.002 + 100, p.y * 0.002, time * 0.0001);
        
        p.vx = noiseX * p.speed;
        p.vy = noiseY * p.speed;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.opacity})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [createParticles, backgroundColor]);

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {children}
    </div>
  );
};
export default Vortex;
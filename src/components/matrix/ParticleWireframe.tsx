import React, { useEffect, useRef, useMemo } from 'react';
import type { Tag } from '../../types';

interface ParticleWireframeProps {
    tagType?: Tag['type'] | string;
    width?: number;
    height?: number;
}

const TYPE_COLORS: Record<string, string> = {
    person: '#3b82f6',   // blue-500
    pet: '#a855f7',      // purple-500
    place: '#10b981',    // emerald-500
    thing: '#eab308',    // yellow-500
    event: '#f43f5e',    // rose-500
    concept: '#6366f1',  // indigo-500
    unknown: '#64748b',  // slate-500
};

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.radius = Math.random() * 1.5 + 0.5;
    }

    update(canvasWidth: number, canvasHeight: number) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvasWidth) this.vx *= -1;
        if (this.y < 0 || this.y > canvasHeight) this.vy *= -1;
    }

    draw(ctx: CanvasRenderingContext2D, color: string) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }
}

export const ParticleWireframe: React.FC<ParticleWireframeProps> = ({ tagType = 'unknown' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const baseColor = useMemo(() => {
        return TYPE_COLORS[tagType as string] || TYPE_COLORS.unknown;
    }, [tagType]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];

        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
                initParticles();
            }
        };

        const initParticles = () => {
            particles = [];
            const area = canvas.width * canvas.height;
            const particleCount = Math.min(Math.floor(area / 4000), 100);
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle(canvas.width, canvas.height));
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw connecting lines
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 80) {
                        ctx.beginPath();
                        ctx.strokeStyle = baseColor;
                        ctx.globalAlpha = 1 - distance / 80;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            ctx.globalAlpha = 1.0;

            // Draw and update particles
            particles.forEach((p) => {
                p.update(canvas.width, canvas.height);
                p.draw(ctx, baseColor);
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize(); // Initial sizing
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [baseColor]);

    return (
        <div className="absolute inset-0 w-full h-full bg-slate-900/80 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center">
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
            <div className="z-10 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: baseColor }} />
                <span className="text-[9px] uppercase tracking-widest text-white/70 font-mono">
                    Generating Variant
                </span>
            </div>
        </div>
    );
};

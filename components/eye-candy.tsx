'use client';

import { useEffect } from 'react';

export function EyeCandy(): null {
  useEffect(() => {
    // ── Canvas particle system ──
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    type Particle = {
      x: number; y: number;
      size: number;
      speedX: number; speedY: number;
      opacity: number;
      isGhost: boolean;
    };

    const particles: Particle[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.25 + 0.05,
      isGhost: Math.random() > 0.75,
    }));

    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x > canvas.width)  p.x = 0;
        if (p.x < 0)             p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0)             p.y = canvas.height;

        ctx.fillStyle = `rgba(96,165,250,${p.opacity})`;   // blue-400

        if (p.isGhost) {
          // tiny ghost silhouette: circle head + squiggly base
          const s = p.size * 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y - s, s, Math.PI, 0);
          ctx.lineTo(p.x + s, p.y + s * 0.6);
          ctx.quadraticCurveTo(p.x + s * 0.6, p.y + s * 0.2, p.x, p.y + s * 0.6);
          ctx.quadraticCurveTo(p.x - s * 0.6, p.y + s, p.x - s, p.y + s * 0.6);
          ctx.lineTo(p.x - s, p.y - s);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    // ── Cursor glow trail ──
    const trail = document.createElement('div');
    trail.style.cssText = `
      position:fixed;width:24px;height:24px;border-radius:50%;
      background:radial-gradient(circle,rgba(96,165,250,0.35),transparent);
      pointer-events:none;z-index:9999;
      transition:transform 0.12s ease,opacity 0.2s ease;
      opacity:0;transform:translate(-50%,-50%);
    `;
    document.body.appendChild(trail);

    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; trail.style.opacity = '1'; };
    document.addEventListener('mousemove', onMove);

    const animTrail = () => {
      tx += (mx - tx) * 0.15;
      ty += (my - ty) * 0.15;
      trail.style.left = `${tx}px`;
      trail.style.top  = `${ty}px`;
      requestAnimationFrame(animTrail);
    };
    animTrail();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMove);
      canvas.remove();
      trail.remove();
    };
  }, []);

  return null;
}

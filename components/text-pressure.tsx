'use client';

import { useEffect, useRef, useState } from 'react';

interface TextPressureProps {
  readonly text: string;
  readonly textColor?: string;
  readonly minFontSize?: number;
  readonly className?: string;
}

export default function TextPressure({
  text,
  textColor = 'currentColor',
  minFontSize = 56,
  className = '',
}: TextPressureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isMobile) return;

    const chars = container.querySelectorAll('.char');

    const handleMouseMove = (e: MouseEvent) => {
      chars.forEach((char) => {
        const rect = char.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        const influence = Math.max(0, 1 - dist / 200);
        (char as HTMLElement).style.fontWeight = (400 + influence * 500).toString();
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'center',
        fontSize: `${minFontSize}px`,
        color: textColor,
        fontWeight: isMobile ? 700 : 400,
        transition: 'all 0.1s ease-out',
        userSelect: 'none',
        lineHeight: 1.1,
      }}
    >
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="char"
          style={{
            display: 'inline-block',
            transition: 'all 0.1s ease-out',
            whiteSpace: char === ' ' ? 'pre' : 'normal',
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

'use client';

import { useEffect, useRef, useCallback } from 'react';

const CHARS = '01{}[]()<>;:=/\\|!@#$%^&*~`+-_.?,abcdefghijklmnopqrstuvwxyz';
const COL_GAP = 14;
const ROW_H = 16;
const FONT = '12px monospace';

interface Column {
  x: number;
  y: number;
  speed: number;
  chars: number[];
  len: number;
  phase: number;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickChar() {
  return CHARS.charCodeAt(Math.floor(Math.random() * CHARS.length));
}

function makeCol(x: number, canvasH: number): Column {
  const len = Math.floor(rand(4, 18));
  const chars: number[] = [];
  for (let i = 0; i < len; i++) chars.push(pickChar());
  return {
    x,
    y: -len * ROW_H - Math.random() * canvasH,
    speed: rand(0.3, 1.2),
    chars,
    len,
    phase: Math.random() * Math.PI * 2,
  };
}

export default function AsciiTerminal({
  color = '#999',
  opacity = 0.12,
  style,
  ...rest
}: {
  color?: string;
  opacity?: number;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLCanvasElement>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<Column[]>([]);
  const rafRef = useRef<number>(0);
  const lastRef = useRef(0);

  const init = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    cvs.width = w * dpr;
    cvs.height = h * dpr;
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';

    const cols: Column[] = [];
    const numCols = Math.ceil(w / COL_GAP) + 2;
    for (let i = 0; i < numCols; i++) {
      cols.push(makeCol(i * COL_GAP, h));
    }
    columnsRef.current = cols;
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    init();

    const ctx = cvs.getContext('2d', { alpha: true })!;

    const draw = (now: number) => {
      const dt = lastRef.current ? (now - lastRef.current) / 16 : 1;
      lastRef.current = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cvs.width;
      const h = cvs.height;

      ctx.clearRect(0, 0, w, h);
      ctx.font = `${Math.round(12 * dpr)}px monospace`;
      ctx.textBaseline = 'top';

      const cols = columnsRef.current;
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        col.y += col.speed * dt * dpr;

        for (let i = 0; i < col.len; i++) {
          const cy = col.y + i * ROW_H * dpr;
          if (cy < -ROW_H * dpr || cy > h) continue;

          const progress = i / col.len;
          const fade = progress < 0.3
            ? progress / 0.3
            : progress > 0.7
              ? (1 - progress) / 0.3
              : 1;

          const diag = (col.x * dpr / w + cy / h) / 2;
          const reveal = Math.max(0, Math.min(1, (diag - 0.15) / 0.5));

          const a = fade * reveal * opacity;
          if (a < 0.005) continue;

          if (Math.random() < 0.002) col.chars[i] = pickChar();

          ctx.fillStyle = color;
          ctx.globalAlpha = a;
          ctx.fillText(
            String.fromCharCode(col.chars[i]),
            col.x * dpr,
            cy,
          );
        }

        if (col.y > h / dpr + col.len * ROW_H) {
          cols[c] = makeCol(col.x, h / dpr);
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const onResize = () => init();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [color, opacity, init]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
      {...rest}
    />
  );
}

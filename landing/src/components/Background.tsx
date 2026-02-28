'use client';

import dynamic from 'next/dynamic';

const AsciiTerminal = dynamic(() => import('./AsciiTerminal'), { ssr: false });

export default function Background() {
  return (
    <>
      <AsciiTerminal color="#888" opacity={0.14} />
      {/* Diagonal gradient overlay: hides chars at top-left, reveals at bottom-right */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background:
            'linear-gradient(112deg, #EFEFEF 0%, #EFEFEF 45%, rgba(239,239,239,0) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    </>
  );
}

'use client';

import dynamic from 'next/dynamic';

const PixelSnow = dynamic(() => import('./PixelSnow'), { ssr: false });

export default function Background() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
      }}
    >
      <PixelSnow
        color="#808080"
        flakeSize={0.005}
        minFlakeSize={0.8}
        pixelResolution={400}
        speed={1.25}
        density={0.3}
        direction={125}
        brightness={1}
        depthFade={8}
        farPlane={20}
        gamma={1.0}
        variant="square"
        style={{ opacity: 0.2 }}
      />
      {/* Diagonal gradient overlay: hides snow at top-left, reveals at bottom-right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(112deg, #EFEFEF 0%, #EFEFEF 50%, rgba(239,239,239,0.005) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

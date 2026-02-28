"use client";

import dynamic from "next/dynamic";

const LetterGlitch = dynamic(() => import("./LetterGlitch"), { ssr: false });

export default function Background() {
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.25,
        }}
      >
        <LetterGlitch
          glitchColors={[
            "#000000",
            "#333333",
            "#666666",
            "#999999",
            "#CCCCCC",
            "#EFEFEF",
          ]}
          glitchSpeed={50}
          centerVignette={false}
          outerVignette={false}
          smooth={true}
        />
      </div>
      {/* Radial gradient overlay: transparent at bottom-right, opaque elsewhere */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background:
            "radial-gradient(circle at 100% 100%, rgba(239,239,239,0) 0%, rgba(239,239,239,1) 50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

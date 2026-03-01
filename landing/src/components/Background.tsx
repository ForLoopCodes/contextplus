"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LetterGlitch = dynamic(() => import("./LetterGlitch"), { ssr: false });

export default function Background() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme === "dark");
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

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
          background: isDark ? "#0a0a0a" : "#efefef",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          pointerEvents: "none",
          opacity: isDark ? 0.05 : 0.25,
        }}
      >
        <LetterGlitch
          glitchColors={
            isDark
              ? ["#ffffff", "#f0f0f0", "#e0e0e0", "#d0d0d0"]
              : [
                  "#000000",
                  "#333333",
                  "#666666",
                  "#999999",
                  "#CCCCCC",
                  "#EFEFEF",
                ]
          }
          glitchSpeed={50}
          centerVignette={false}
          outerVignette={false}
          smooth={true}
        />
      </div>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: isDark
            ? "radial-gradient(circle at 100% 100%, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 50%)"
            : "radial-gradient(circle at 100% 100%, rgba(239,239,239,0) 0%, rgba(239,239,239,1) 50%)",
          pointerEvents: "none",
          zIndex: 0,
          transition: "background 0.3s ease",
        }}
      />
    </>
  );
}

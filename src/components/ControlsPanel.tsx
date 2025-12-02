import { useUIStore } from "../state/store";
import { useState, useEffect } from "react";

export default function ControlsPanel() {
  const { quality, setQuality, engineType } = useUIStore();
  const [fps, setFps] = useState(0);

  // FPS counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      requestAnimationFrame(measureFps);
    };
    
    const rafId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        padding: "16px 20px",
        background: "linear-gradient(145deg, rgba(8, 12, 24, 0.95) 0%, rgba(16, 24, 40, 0.95) 100%)",
        borderRadius: 16,
        border: "1px solid rgba(100, 150, 255, 0.15)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        color: "#b8c8e8",
        minWidth: 200,
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Header with badges */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: "1px solid rgba(100, 150, 255, 0.1)",
      }}>
        <strong style={{ fontSize: 14, color: "#7af", letterSpacing: 1.5 }}>
          🎛️ CONTROLS
        </strong>
        
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* FPS Badge */}
          <span style={{
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: 6,
            background: fps >= 55 ? "rgba(0, 200, 100, 0.25)" : fps >= 30 ? "rgba(255, 180, 0, 0.25)" : "rgba(255, 80, 80, 0.25)",
            color: fps >= 55 ? "#0f8" : fps >= 30 ? "#fb0" : "#f55",
            fontWeight: 700,
            minWidth: 50,
            textAlign: "center",
          }}>
            {fps} FPS
          </span>
          
          {/* Engine Badge */}
          <span style={{
            fontSize: 9,
            padding: "3px 8px",
            borderRadius: 6,
            background: engineType === "WebGPU" 
              ? "rgba(0, 200, 100, 0.3)" 
              : "rgba(255, 140, 0, 0.3)",
            color: "#fff",
            fontWeight: 700,
            letterSpacing: 0.5,
          }}>
            {engineType || "..."}
          </span>
        </div>
      </div>

      {/* Quality selector */}
      <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7 }}>
          Quality
        </span>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as "low" | "high")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(100, 150, 255, 0.2)",
            background: "rgba(20, 35, 60, 0.8)",
            color: "#c0d0e8",
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "inherit",
          }}
        >
          <option value="low">⚡ Low</option>
          <option value="high">✨ High</option>
        </select>
      </label>

      {/* Bottom legend */}
      <div style={{ 
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px solid rgba(100, 150, 255, 0.1)",
        fontSize: 10, 
        opacity: 0.5,
        lineHeight: 1.6,
      }}>
        <div>🖱️ Left-drag → Rotate</div>
        <div>🖱️ Right-drag → Pan</div>
        <div>🔘 Scroll → Zoom</div>
        <div>👆 Click model → Focus</div>
      </div>
    </div>
  );
}

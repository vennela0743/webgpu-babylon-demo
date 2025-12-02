export default function LoaderOverlay({ show = false }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255,255,255,0.7)",
        display: "grid",
        placeItems: "center",
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      <div>Loading…</div>
    </div>
  );
}

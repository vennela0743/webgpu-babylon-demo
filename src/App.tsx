import CanvasHost from "./components/CanvasHost";
import ControlsPanel from "./components/ControlsPanel";


export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <CanvasHost />
      <ControlsPanel />
    </div>
  );
}

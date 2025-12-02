import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Note: StrictMode disabled for WebGPU compatibility
// WebGPU doesn't handle double mount/unmount well
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

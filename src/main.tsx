import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Root element - no overflow restrictions to allow page scrolling
const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(<App />);

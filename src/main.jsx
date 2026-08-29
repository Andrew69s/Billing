import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installStorage } from "./lib/storage.js";
import "./index.css";
import App from "./App.jsx";

// window.storage → Supabase (таблиця kv). Див. src/lib/storage.js
installStorage();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

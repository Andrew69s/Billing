import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installStorage } from "./lib/storage.js";
import "./index.css";
import App from "./App.jsx";

// Підключаємо локальне сховище (localStorage) замість window.storage з артефакту.
installStorage();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

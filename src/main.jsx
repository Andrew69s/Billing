import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installStorage } from "./lib/storage.js";
import { initPwaUpdate } from "./lib/pwaUpdate.js";
import { supabase } from "./lib/supabase.js";
import "./index.css";
import App from "./App.jsx";

// window.storage → Supabase (таблиця kv). Див. src/lib/storage.js
installStorage();
initPwaUpdate();

// коли вкладка знову активна після довгого простою — відновити автооновлення
// токена й одразу підтягти свіжу сесію (інакше Edge-функції ловлять "unauthorized")
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      supabase.auth.startAutoRefresh();
      supabase.auth.getSession().then(({ data }) => {
        const exp = data?.session?.expires_at ? data.session.expires_at * 1000 : 0;
        if (exp && exp - Date.now() < 120_000) supabase.auth.refreshSession().catch(() => {});
      });
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* Автомасштаб інтерфейсу під екран.
   Базовий макет — 1180×760. На більшому вікні (монітор) увесь застосунок, разом із модалками,
   пропорційно збільшується, щоб не лишати порожніх смуг: масштаб = min(ширина/1180, висота/760),
   від 1 до 1.8. Вузькі екрани (телефон, планшет) не чіпаємо. Значення — у змінній --ui-zoom. */
export function initScreenFit() {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("w") === "1") return; // віджет — без масштабу
  const root = document.documentElement;
  const apply = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let z = w < 1000 ? 1 : Math.min(1.8, w / 1180, h / 760);
    z = z < 1.06 ? 1 : Math.round(z * 20) / 20;
    root.style.setProperty("--ui-zoom", String(z));
    window.__uiZoom = z;
  };
  apply();
  window.addEventListener("resize", apply);
}

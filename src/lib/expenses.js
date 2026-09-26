import { supabase } from "./supabase.js";

/* Категорії витрат магазину. «supply» не вноситься вручну — він приходить
   автоматично з актів списання складу, тому в модалці його не показуємо. */
export const EXPENSE_CATEGORIES = [
  { key: "supply", label: "Хоз-забезпечення", color: "#DCA94A", auto: true },
  { key: "utility", label: "Комунальні та зв'язок", color: "#6E9FC4" },
  { key: "repair", label: "Ремонт і обслуговування", color: "#C98F6B" },
  { key: "transport", label: "Транспорт і доставка", color: "#7FBF8F" },
  { key: "promo", label: "Реклама і локальні промо", color: "#B892C4" },
  { key: "equip", label: "Обладнання та інвентар", color: "#5F8E93" },
  { key: "guest", label: "Представницькі", color: "#C9A97F" },
  { key: "other", label: "Інше", color: "#8E97A6" },
];
export const MANUAL_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => !c.auto);
export const catOf = (key) => EXPENSE_CATEGORIES.find((c) => c.key === key) || { key, label: key, color: "#8E97A6" };

export async function listExpenses({ from, to, salonKey } = {}) {
  let q = supabase.from("expenses").select("*").order("spent_on", { ascending: false });
  if (from) q = q.gte("spent_on", from);
  if (to) q = q.lte("spent_on", to);
  if (salonKey) q = q.eq("salon_key", salonKey);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createExpense({ salonKey, spentOn, category, title, amount, receiptPath }) {
  const row = {
    salon_key: salonKey,
    spent_on: spentOn,
    category: category || "other",
    title: (title || "").trim(),
    amount: Math.max(0, Number(amount) || 0),
    receipt_path: receiptPath || "",
  };
  if (!row.salon_key) throw new Error("Не вказано магазин");
  if (!row.spent_on) throw new Error("Не вказано дату");
  if (!row.title) throw new Error("Вкажіть, що саме за витрата");
  if (!row.amount) throw new Error("Сума має бути більшою за нуль");
  const { data, error } = await supabase.from("expenses").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateExpense(id, patch) {
  const { error } = await supabase.from("expenses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id, receiptPath) {
  if (receiptPath) await supabase.storage.from("receipts").remove([receiptPath]).catch(() => {});
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/* Чек: стискаємо на клієнті й кладемо ФАЙЛОМ у приватний бакет.
   У рядку лишається тільки шлях, тож список витрат не тягне фото. */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не вдалося стиснути фото"))), "image/jpeg", 0.75);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadReceipt(salonKey, file) {
  const blob = await shrink(file);
  const name = `${salonKey}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("receipts").upload(name, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return name;
}

/* Підписане посилання живе годину — вистачає, щоб подивитись чек у картці. */
export async function receiptUrl(path) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
  if (error) throw error;
  return data?.signedUrl || "";
}

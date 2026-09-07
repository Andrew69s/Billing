// =========================================================
//  push-send — ранковий підсумок по web-push
//  Виклик: POST {}            → усім підпискам
//          POST { only: "<cabinet_key>" }  → лише цьому кабінету (тест)
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUB = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@dnipro-m.local";

webpush.setVapidDetails(VAPID_SUB, VAPID_PUB, VAPID_PRIV);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SALONS = [
  { key: "gorodok-peremyshlska", city: "Городок", area: "область" },
  { key: "mostyska-rynok", city: "Мостиська", area: "область" },
  { key: "turka-sheptytskoho", city: "Турка", area: "область" },
  { key: "lviv-lypynskoho", city: "Львів · Липинського", area: "місто" },
  { key: "lviv-shyretska", city: "Львів · Щирецька", area: "місто" },
  { key: "lviv-shevchenka", city: "Львів · Шевченка", area: "місто" },
  { key: "lviv-kavaleridze", city: "Львів · Кавалерідзе", area: "місто" },
  { key: "lviv-vashyngtona", city: "Львів · Вашингтона", area: "місто" },
];
const BASE_PLAN: Record<string, number> = {
  "gorodok-peremyshlska": 1400000, "mostyska-rynok": 900000, "turka-sheptytskoho": 900000,
  "lviv-lypynskoho": 1500000, "lviv-shyretska": 1400000, "lviv-shevchenka": 800000,
  "lviv-vashyngtona": 900000, "lviv-kavaleridze": 800000,
};

const pad = (n: number) => String(n).padStart(2, "0");
const daysInYm = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const money = (n: number) => Math.round(n).toLocaleString("uk-UA") + " ₴";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch { /* {} */ }

  const svc = createClient(SUPABASE_URL, SERVICE);
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const yd = new Date(now.getTime() - 86400000);
  const yStr = `${yd.getUTCFullYear()}-${pad(yd.getUTCMonth() + 1)}-${pad(yd.getUTCDate())}`;
  const dim = daysInYm(ym);
  const dayCount = Math.min(Math.max(1, Number(yStr.slice(8, 10))), dim); // норма — станом на вчора

  const { data: rows } = await svc.from("territory_metrics")
    .select("salon_key,work_date,planner,manual").gte("work_date", `${ym}-01`);
  const { data: plansDb } = await svc.from("territory_plans").select("salon_key,plan");
  const planAssort: Record<string, number> = { ...BASE_PLAN };
  for (const p of plansDb || []) {
    const a = p?.plan?.assort;
    if (a != null) planAssort[p.salon_key] = Number(a) || BASE_PLAN[p.salon_key] || 0;
  }

  const eff = (r: any) => {
    const m = r.manual || {}, p = r.planner || {};
    return (m.assort != null && m.assort !== "") ? Number(m.assort) || 0 : Number(p.assort) || 0;
  };
  const byKey: Record<string, { y: number; mtd: number }> = {};
  for (const r of rows || []) {
    const b = byKey[r.salon_key] = byKey[r.salon_key] || { y: 0, mtd: 0 };
    const v = eff(r);
    if (r.work_date === yStr) b.y = v;
    b.mtd += v;
  }
  const areaKeys = (a: string) => SALONS.filter((s) => s.area === a).map((s) => s.key);
  const allKeys = SALONS.map((s) => s.key);

  const summ = (keys: string[]) => {
    const yv = keys.reduce((a, k) => a + (byKey[k]?.y || 0), 0);
    const mtd = keys.reduce((a, k) => a + (byKey[k]?.mtd || 0), 0);
    const pl = keys.reduce((a, k) => a + (planAssort[k] || 0), 0);
    const norm = pl ? (pl / dim) * dayCount : 0;
    return { yv, mtd, pct: pl ? Math.round((mtd / pl) * 100) : 0, gap: mtd - norm };
  };

  const msgFor = (cab: string) => {
    let keys: string[], name: string;
    if (cab === "manager" || cab === "accountant") { keys = allKeys; name = "мережа"; }
    else if (cab === "andriy") { keys = areaKeys("область"); name = "територія область"; }
    else if (cab === "ivan") { keys = areaKeys("місто"); name = "територія місто"; }
    else {
      const s = SALONS.find((x) => x.key === cab);
      if (!s) return null;
      keys = [cab]; name = s.city;
    }
    const s = summ(keys);
    const gapTxt = s.gap < 0
      ? `відстаємо ${money(Math.abs(s.gap))} від норми`
      : `+${money(s.gap)} до норми`;
    return {
      title: `Dnipro-M · ${cap(name)}`,
      body: `Вчора: ${money(s.yv)}. За місяць: ${s.pct}% плану, ${gapTxt}.`,
    };
  };

  let q = svc.from("push_subscriptions").select("*");
  if (body.only) q = q.eq("cabinet_key", body.only);
  const { data: subs } = await q;

  let sent = 0, gone = 0, failed = 0;
  for (const sub of subs || []) {
    const m = msgFor(sub.cabinet_key);
    if (!m) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...m, tag: "daily", url: "/?w=1" }),
        { TTL: 3600 },
      );
      await svc.from("push_subscriptions")
        .update({ last_sent: new Date().toISOString(), last_error: null }).eq("id", sub.id);
      sent++;
    } catch (e: any) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        await svc.from("push_subscriptions").delete().eq("id", sub.id);
        gone++;
      } else {
        failed++;
        await svc.from("push_subscriptions")
          .update({ last_error: String(e?.body || e?.message || e).slice(0, 200) }).eq("id", sub.id);
      }
    }
  }
  return json({ ok: true, subs: subs?.length || 0, sent, gone, failed });
});

import { supabase, rtChannel } from "./supabase.js";

/* Хто виключений із командних бонусів/ЕЗ конкретного салону за конкретний
   місяць (напр. стажери). За замовчуванням усі активні діляться порівну —
   тут лише винятки, які вмикає керуючий шестернею в розрахунку ЗП. */
export async function listBonusTeamExclude(salonKey, ym) {
  const { data, error } = await supabase.from("bonus_team_exclude")
    .select("employee_id").eq("salon_key", salonKey).eq("ym", ym);
  if (error) throw error;
  return (data || []).map((r) => r.employee_id);
}

export async function setBonusTeamExclude(salonKey, ym, employeeId, excluded) {
  if (excluded) {
    const { error } = await supabase.from("bonus_team_exclude")
      .upsert({ salon_key: salonKey, ym, employee_id: employeeId },
        { onConflict: "salon_key,ym,employee_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bonus_team_exclude")
      .delete().eq("salon_key", salonKey).eq("ym", ym).eq("employee_id", employeeId);
    if (error) throw error;
  }
}

export function subscribeBonusTeamExclude(onChange) {
  const ch = rtChannel("bonus-team-exclude")
    .on("postgres_changes", { event: "*", schema: "public", table: "bonus_team_exclude" }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

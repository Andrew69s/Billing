import { writeFileSync } from "fs";

const E = [
  ["lviv-shyretska", "Луценко Олексій", "+380666098661", "1990-12-10", null, "seller", ""],
  ["lviv-shyretska", "Святий Олександр", "+380934635827", "2003-03-30", "2025-09-10", "seller", "прийом у таблиці: 01.03.2025 / 10.09.2025"],
  ["lviv-shevchenka", "Михальський Сергій", "+380672047798", "2006-09-26", "2024-08-01", "acting_manager", ""],
  ["lviv-shevchenka", "Денис Лобода", "+380992548473", "2002-05-07", null, "seller", ""],
  ["lviv-lypynskoho", "Гута Василина", "+380979699323", "2007-08-20", null, "seller", ""],
  ["lviv-lypynskoho", "Сушко Тетяна", "+380639396390", "2001-08-18", null, "acting_manager", ""],
  ["lviv-lypynskoho", "Єфременко Роман", "+380687338879", "2007-04-15", null, "intern", ""],
  ["lviv-vashyngtona", "Юзва Артур", "+380634594978", "2004-10-09", null, "seller", ""],
  ["lviv-vashyngtona", "Вдовенко Анна", "", "2008-03-04", null, "intern", ""],
  ["lviv-kavaleridze", "Федькович Олег", "+380676849015", "2006-01-17", null, "manager", ""],
  ["lviv-kavaleridze", "Кузик Максим", "+380975188308", "2006-03-23", null, "seller", ""],
  ["gorodok-peremyshlska", "Дяківнич Христина", "+380680597518", "2006-01-07", null, "manager", ""],
  ["gorodok-peremyshlska", "Науличний Андрій", "+380977923184", "1999-12-12", null, "seller", ""],
  ["gorodok-peremyshlska", "Сергієнко Денис", "+380680835093", "2004-10-10", "2026-06-03", "seller", ""],
  ["mostyska-rynok", "Харів Микола", "+380673988191", "1999-09-26", "2022-07-20", "manager", ""],
  ["mostyska-rynok", "Остаповець Катерина", "+380965634731", "2004-10-14", "2026-02-09", "seller", ""],
  ["turka-sheptytskoho", "Торищак Андрій", "+380502136360", "1999-05-26", "2023-10-02", "manager", ""],
  ["turka-sheptytskoho", "Сергій Боклах", "+380997367023", "2005-05-18", "2026-03-01", "seller", ""],
];

const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const rows = E.map(([sk, n, p, d, h, r, note]) => {
  const hist = JSON.stringify([{ at: new Date().toISOString(), by: "import", action: "hired", salon: sk }]);
  return `(${q(sk)}, ${q(n)}, ${q(p)}, ${d ? q(d) : "null"}, ${h ? q(h) : "null"}, ${q(r)}, ${q(note)}, ${q(hist)}::jsonb)`;
}).join(",\n");

const sql = `insert into public.employees (salon_key, full_name, phone, dob, hired_at, role, note, history) values\n${rows};`;
writeFileSync("/tmp/emp_import.json", JSON.stringify({ query: sql }));
console.log("prepared", E.length, "rows");

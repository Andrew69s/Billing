# Edge Function `calc`

Рушій мотивації ТМ і СМ + тексти «Умови». Уся логіка нарахувань — тут, на сервері;
у браузер формули й таблиці не потрапляють.

## Файли
- `index.ts` — HTTP-обробник, авторизація, рушії ТМ/СМ
- `conditions.ts` — тексти «Умови» (копія `src/conditions.js`)

## Деплой через Dashboard (без CLI)
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via editor**
2. Назва: `calc`
3. Створити два файли з тим самим вмістом, що тут: `index.ts` і `conditions.ts`
4. **Deploy**

Функція сама отримує `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
з середовища — додаткові секрети не потрібні.

## Деплой через CLI (якщо встановлено)
```
supabase functions deploy calc --project-ref taiqrxlehnfkuvokgwqu
```

## Операції (POST, тіло JSON)
| `op` | Вхід | Хто може | Повертає |
|------|------|----------|----------|
| `tm` | `{data, grade, tmKey, ym}` | керівник/адмін, бухгалтер, офіс(view_consolidation), сам ТМ | результат `calcAll` |
| `tm-batch` | `{items:[…]}` | те саме | масив результатів |
| `sm` | `{data, salonKey, ym}` | керівник/адмін, бухгалтер, офіс, сам салон, поточний ТМ салону | результат `calcSmAll` |
| `sm-batch` | `{items:[…]}` | те саме | масив |
| `conditions` | `{}` | усі авторизовані | `{tm, sm}` (tm=null для салону) |
| `meta` | `{}` | усі авторизовані | лейбли брекетів/категорій/коефіцієнтів |

Авторизація — за рядком у `cab_map` (не за JWT-метаданими).

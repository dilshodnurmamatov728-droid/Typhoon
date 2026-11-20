# Typhoon — Kunlik hisobot

Har kuni: nima qilindi, nima test qilindi, Dilshod nima qilishi kerak. Eng yangisi tepada.

## 2026-11-20 (2-kun)

**Qilindi**
- `supabase/migrations/001_init.sql` — ma'lumotlar bazasi: `profiles`, `drivers`, `rides`, `ride_offers`; eng yaqin haydovchini topish funksiyasi; RLS xavfsizlik; Realtime.
- `docs/MASTER_PLAN.md` — to'liq vizyon (taxi, AI dispatcher, intercity, courier, cargo, dron, biznes model, brend, intro, bosh ofis) — hech narsa unutilmasligi uchun.
- `docs/MODULES.md` — har bir modul nima qiladi, oddiy tilda.
- `LICENSE` (proprietary) va README'ga himoya ogohlantirishi.

**Test qilindi**
- Baza sxemasi lokal PostgreSQL'da ishga tushirildi (PostGIS o'rniga sodda geometriya bilan): eng yaqin haydovchi to'g'ri tanlanadi; offline, tasdiqlanmagan va avval taklif olgan haydovchilar chiqarib tashlanadi; haydovchi o'zini "approved" qila olmaydi; mijoz boshqalarning ma'lumotini ko'rmaydi. ✅
- Haqiqiy Supabase'da hali ishga tushirilmagan.

**Dilshod uchun**
- [ ] `git add .` → `git commit -m "Kun 2: database"` → `git push`
- [ ] GitHub repo'ni Private qilish
- [ ] supabase.com da akkaunt ochish
- [ ] Ilovada "Sputnik" bosilganda xarita ko'rinadimi — javob berish

## 2026-11-19 (1-kun)

**Qilindi:** stack tanlandi; papka tartiblandi (eski kod `_old/`); README, .gitignore, CLAUDE.md, ROADMAP; customer-app (Expo SDK 58) — xarita, GPS, markaziy pin, sputnik, manzilni aniqlash.
**Test qilindi:** telefonda ishladi — GPS ±20 m, manzil "Toshkent ko'cha, 117, Stantsiya-Karakul" aniqlandi ✅. Muammo: xarita foni qora (tiles yuklanmayapti) — tekshirilmoqda.
**Hal qilingan muammolar:** PowerShell skript ruxsati; Wi-Fi/firewall (8081 port ochildi).

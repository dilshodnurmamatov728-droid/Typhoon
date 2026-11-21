# Typhoon — Kunlik hisobot

Har kuni: nima qilindi, nima test qilindi, Dilshod nima qilishi kerak. Eng yangisi tepada.

## 2026-11-21 (3-kun)

**Qilindi**
- `supabase/migrations/003_app_support.sql` — ilovalar uchun lat/lng ustunlari, mijoz izohi (`pickup_note`), haydovchi taklif kelgan buyurtmani ko'rishi, mijoz va haydovchi bir-birining ism/telefonini faqat o'z safarida ko'rishi.
- Ikkala ilova Supabase'ga ulandi (`src/lib/supabase.ts`, `.env.example`):
  - **Customer app:** avtomatik kirish (SMS'siz), birinchi buyurtmada ism + telefon, izoh maydoni, buyurtma yuborish, "Haydovchi qidirilmoqda", haydovchi mashinasi/raqami, xaritada haydovchi 🚕 jonli, qo'ng'iroq, bekor qilish.
  - **Driver app:** login/parol, online/offline, joylashuvni bazaga yuborish, jonli takliflar + 15 s taymer, qabul/rad, "Yo'l ko'rsat" (Yandex/Google), mijozga qo'ng'iroq, Keldim → Boshlash → Yakunlash, mijoz bekor qilsa xabar.
- `supabase/admin/add_driver.sql` — yangi haydovchi qo'shish shabloni.

**Test qilindi**
- 003 migratsiya va xavfsizlik qoidalari lokal PostgreSQL'da ✅ (haydovchi taklifdagi buyurtmani ko'radi; begona ko'rmaydi; mijoz haydovchi profilini faqat qabuldan keyin ko'radi; mijoz rolini o'zgartira olmaydi).
- Ilova kodi telefonda hali test qilinmagan — Supabase loyihasi kerak.

**Dilshod uchun**
- [ ] Supabase loyihasi + 001, 002, 003 ni ishga tushirish
- [ ] Anonymous sign-in'ni yoqish
- [ ] Ikkala ilovaga paketlar va `.env`
- [ ] 2 telefonda birinchi haqiqiy buyurtma testi
- [ ] `git push`

## 2026-11-20 (2-kun)

**Qilindi**
- `supabase/migrations/001_init.sql` — ma'lumotlar bazasi: `profiles`, `drivers`, `rides`, `ride_offers`; eng yaqin haydovchini topish funksiyasi; RLS xavfsizlik; Realtime.
- `docs/MASTER_PLAN.md` — to'liq vizyon (taxi, AI dispatcher, intercity, courier, cargo, dron, biznes model, brend, intro, bosh ofis) — hech narsa unutilmasligi uchun.
- `docs/MODULES.md` — har bir modul nima qiladi, oddiy tilda.
- `LICENSE` (proprietary) va README'ga himoya ogohlantirishi.

**Test qilindi**
- Baza sxemasi lokal PostgreSQL'da ishga tushirildi (PostGIS o'rniga sodda geometriya bilan): eng yaqin haydovchi to'g'ri tanlanadi; offline, tasdiqlanmagan va avval taklif olgan haydovchilar chiqarib tashlanadi; haydovchi o'zini "approved" qila olmaydi; mijoz boshqalarning ma'lumotini ko'rmaydi. ✅
- Haqiqiy Supabase'da hali ishga tushirilmagan.

**Kechki qism: Dispatch v1**
- `supabase/migrations/002_dispatch.sql` — eng yaqin haydovchiga 15 s taklif, rad/javobsiz → keyingisi, 3 → 6 km, `no_driver`; haydovchi javobi, bekor qilish, safar bosqichlari (keldi → yo'lda → tugadi); har 5 s muddati o'tgan takliflarni tekshirish (pg_cron).
- 8 ta stsenariy lokal PostgreSQL'da test qilindi — hammasi ✅ (batafsil: `docs/TRAINING.md`, 2-dars).
- `docs/TRAINING.md` — 1-dars (ma'lumotlar bazasi) va 2-dars (dispatch), mashqlar bilan.

**Dilshod uchun**
- [ ] `git add .` → `git commit -m "Kun 2: database va dispatch"` → `git push`
- [ ] GitHub repo'ni Private qilish
- [ ] supabase.com da akkaunt ochish
- [ ] Ilovada "Sputnik" bosilganda xarita ko'rinadimi — javob berish

## 2026-11-19 (1-kun)

**Qilindi:** stack tanlandi; papka tartiblandi (eski kod `_old/`); README, .gitignore, CLAUDE.md, ROADMAP; customer-app (Expo SDK 58) — xarita, GPS, markaziy pin, sputnik, manzilni aniqlash.
**Test qilindi:** telefonda ishladi — GPS ±20 m, manzil "Toshkent ko'cha, 117, Stantsiya-Karakul" aniqlandi ✅. Muammo: xarita foni qora (tiles yuklanmayapti) — tekshirilmoqda.
**Hal qilingan muammolar:** PowerShell skript ruxsati; Wi-Fi/firewall (8081 port ochildi).

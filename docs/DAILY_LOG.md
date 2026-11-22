# Typhoon — Kunlik hisobot

Har kuni: nima qilindi, nima test qilindi, Dilshod nima qilishi kerak. Eng yangisi tepada.

## 2026-11-22 (4-kun)

**Qilindi (Dilshod kelguncha, ruxsatsiz ishlar)**
- `006_ratings_earnings.sql` — mijoz haydovchini 1–5 yulduz bilan baholaydi (`rate_ride`), haydovchi reytingi oxirgi 100 baho o'rtachasi; haydovchi daromadi bugun/hafta (`driver_earnings`, Toshkent vaqti).
- **Customer app:** safar tugagach "To'lov: X so'm" + 5 yulduzli baholash ekrani va izoh.
- **Driver app:** "Bugun / Bu hafta / Reyting" kartasi (offline va kutish ekranida).
- Ikkala ilova: sozlama xato bo'lsa yopilib qolmaydi — ekranda sababini ko'rsatadi (APK muammosini topishga ham yordam beradi).

**Test qilindi**
- 006 lokal PostgreSQL'da: daromad yig'indisi to'g'ri (9 900), o'rtacha reyting 4.5, ikki marta baho va begona baho rad etildi ✅.
- Ilovalar: TypeScript sintaksis tekshiruvi o'tdi; telefonda hali sinalmagan.
- 006 Supabase'ga hali o'rnatilmagan (brauzer ruxsati kerak).

**Navbatda**
- APK yopilish sababi: `adb logcat` (Dilshod telefonni ulaydi).
- 006 ni Supabase'ga o'rnatish.
- Google Maps API kaliti.

## 2026-11-21 (3-kun)

**Qilindi**
- `supabase/migrations/003_app_support.sql` — ilovalar uchun lat/lng ustunlari, mijoz izohi (`pickup_note`), haydovchi taklif kelgan buyurtmani ko'rishi, mijoz va haydovchi bir-birining ism/telefonini faqat o'z safarida ko'rishi.
- Ikkala ilova Supabase'ga ulandi (`src/lib/supabase.ts`, `.env.example`):
  - **Customer app:** avtomatik kirish (SMS'siz), birinchi buyurtmada ism + telefon, izoh maydoni, buyurtma yuborish, "Haydovchi qidirilmoqda", haydovchi mashinasi/raqami, xaritada haydovchi 🚕 jonli, qo'ng'iroq, bekor qilish.
  - **Driver app:** login/parol, online/offline, joylashuvni bazaga yuborish, jonli takliflar + 15 s taymer, qabul/rad, "Yo'l ko'rsat" (Yandex/Google), mijozga qo'ng'iroq, Keldim → Boshlash → Yakunlash, mijoz bekor qilsa xabar.
- `supabase/admin/add_driver.sql` — yangi haydovchi qo'shish shabloni.

**Kunduzgi qism: birinchi haqiqiy buyurtma 🎉**
- Supabase loyihasi `typhoon` yaratildi (Free, eu-west-1); 001, 002, 003 o'rnatildi va tekshirildi; anonymous sign-in yoqildi.
- Haydovchi `driver1@typhoon.uz` qo'shildi va tasdiqlandi (test mashina: oq Cobalt, 80 A 123 AA).
- Xato topildi va tuzatildi: bir joyda turgan haydovchining joylashuvi yangilanmay, dispatch uni "eskirgan" deb o'tkazib yuborardi → driver app endi har 20 s signal yuboradi.
- **Birinchi buyurtma serverda:** mijoz Dilshod → dispatch 12 m dagi haydovchiga taklif yubordi → haydovchi 8 soniyada qabul qildi (11:26:08). Ikkala ilova telefonda ishladi ✅.

**Narx va taksometr ✅**
- Tarif: 3000 so'm boshlang'ich + 1 km uchun 1100 so'm (kechasi 22:00–06:00: 1250), 100 so'mgacha yaxlitlanadi (`004_pricing.sql`, `005_base_fare.sql`). 1100/1250 = kunduzi/kechasi — taxmin, Dilshod tasdiqlashi kerak.
- Haydovchi ilovasida jonli taksometr; yakuniy narxni server hisoblaydi; mijoz ilovasida tarif va yakuniy to'lov ko'rinadi.
- **To'liq safar testi:** qabul 11:44:40 → yakun 11:48:18, 155 m, **3 200 so'm** (3000 + 155 m × 1100 = 3170 → 3200) ✅.
- O'rganilgan saboq: test safari "Yakunlash"gacha bormasa haydovchi "band" qoladi.

**Tushdan keyin: APK (to'xtagan joy) ⏸**
- `eas.json` ikkala ilovaga qo'shildi (preview = APK, Supabase kalitlari ichida).
- Driver app APK EAS'da yig'ildi ✅. Oxiridagi `adb` xatosi — faqat emulyatorga o'rnatish qadami (keyingi safar "Install on emulator?" → `n`).
- **Muammo:** APK telefonda ochilishi bilan yopilyapti. Sababi hali aniqlanmagan.
- `adb` o'rnatildi (`C:\platform-tools`). Telefon: Redmi Note 12 Pro, USB debugging yoqildi.

**Kechqurun shu yerdan davom:**
1. Telefonni ulash → USB oynasida "Take no action" → telefonda "USB orqali tuzatishga ruxsat" → OK.
2. Terminal: `C:\platform-tools\adb.exe devices; C:\platform-tools\adb.exe logcat -c; C:\platform-tools\adb.exe logcat -v brief AndroidRuntime:E ReactNativeJS:V ReactNative:V *:S`
3. Typhoon Driver'ni ochish → terminaldagi xatoni Claude'ga yuborish.
4. Taxmin (tasdiqlanmagan): Google Maps API kaliti yo'qligi. Google Cloud'da kalit olish kerak (billing/karta — Dilshod).
5. Keyin: customer-app APK, ikkala APK'ni Google kaliti bilan qayta yig'ish.

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

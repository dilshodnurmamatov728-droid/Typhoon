# Typhoon — Roadmap va progress

Oxirgi yangilanish: 2026-11-19

## Asosiy maqsad

Qorako'l ichida ishlaydigan taxi: mijoz bir tugma bosadi, GPS uning aniq joyini oladi, buyurtma eng yaqin bo'sh haydovchiga boradi. Hozirgi muammo: mijozlar 20–30 daqiqa kutadi, haydovchi 1–2 km uzoqdan biriktiriladi.

## Tanlangan yo'l: tez pilot (~3–4 hafta)

Ish taqsimoti: Claude — ilova kodi. Dilshod — sinov, akkauntlar, haydovchilar, narx, Qorako'ldagi dala ishlari. Kuniga 7–8 soat.

Pilotda qo'lda qilinadi: haydovchilarni Supabase dashboard'da qo'shish/tasdiqlash (admin panel yo'q), bitta belgilangan narx, APK to'g'ridan-to'g'ri tarqatiladi (Play Market keyin), SMS keyin.

| Bosqich | Nima ishlaydi | Taxminiy muddat |
|---|---|---|
| Prototype | 2 telefonda: buyurtma → taklif → qabul → jonli kuzatish → yakun | ~2 hafta |
| Pilot | 5–10 tanish haydovchi, birinchi real mijozlar, APK orqali | ~3–4 hafta |
| To'liq MVP | Admin panel, SMS, reyting, Play Market | pilotdan keyin +3–4 hafta |

## Dilshodning parallel vazifalari (kod bilan bir vaqtda)

- [ ] 5–10 haydovchi bilan gaplashish, pilotga rozilik olish
- [ ] Hozirgi narxlar: Qorako'l ichida taxi qancha oladi
- [ ] Raqobat: Yandex Go va dispetcherlar qanday ishlaydi
- [ ] Qonuniy talablarni aniqlash
- [ ] Google Cloud akkaunt (Maps API kaliti uchun), Supabase akkaunt

## Phase 1 — Prototype qadamlari

- [x] Step 0 — Vizyon, stack, MVP doirasi tanlandi
- [x] Step 1 — Muhit: Node.js v24, Git 2.53 ✅ · Expo Go ⏳ · Supabase akkaunt ⏳
- [x] Step 2 — Loyiha strukturasi + customer-app skeleti telefonda ochiladi
- [ ] Step 3 — Customer app: xarita, GPS, pin, satellite ✅ telefonda ishladi · ⏳ xarita foni qora (tiles)
- [ ] Step 4 — Supabase: sxema yozildi va lokal test qilindi ✅ · ⏳ Supabase akkaunt va loyiha
- [ ] Step 5 — Auth: telefon raqam (avval test rejimi, keyin Eskiz SMS)
- [ ] Step 6 — Driver app skeleti: online/offline, joylashuvni yuborish
- [ ] Step 7 — Buyurtma yaratish (customer) → Realtime orqali driver ko'radi
- [ ] Step 8 — Dispatch v1: eng yaqin haydovchi, 15 s taklif, keyingisiga o'tish, radius 3→6 km
- [ ] Step 9 — Qabul → jonli kuzatish → safar yakuni
- [ ] Step 10 — Ikki telefonda to'liq sinov (prototype tayyor)

## MVP uchun qo'shiladi (prototype'dan keyin)

Haydovchi ro'yxatdan o'tishi + admin tasdiqlashi, admin panel, bekor qilish sabablari, reyting, tarix, narx hisoblash, push notifications, Android fonda joylashuv barqarorligi, Play Market internal testing.

## Hozircha QILINMAYDI

Comfort/Business, Intercity, Courier, Cargo, ovozli kiritish, online to'lov, demand prediction / ML, bonuslar, dron.

## Qarorlar jurnali

| Sana | Qaror | Sabab |
|---|---|---|
| 2026-11-19 | Stack: Expo + TypeScript + Supabase | Bitta til, server sozlashsiz, bepul boshlash |
| 2026-11-19 | Eski FastAPI kodi `_old/` ga | Supabase backend vazifasini bajaradi; eski kod 2 ta "hello" fayldan iborat edi |
| 2026-11-19 | Dispatch v1 — algoritmik, ML yo'q | Real ma'lumot yo'q; avval ishonchli oddiy algoritm |

## Ochiq savollar

- [ ] Narx: belgilangan tarifmi yoki km bo'yicha?
- [ ] Daromad modeli: komissiyami yoki haydovchi obunasi?
- [ ] Qorako'lda raqobat: Yandex Go va mahalliy dispetcherlar bormi?
- [ ] Taxi platformasi uchun qonuniy talablar (litsenziya, self-employed)
- [ ] Eskiz SMS narxi

# Typhoon — Modullar tushuntirmasi

Har bir modul nima qiladi, qayerda turadi va boshqalari bilan qanday bog'lanadi.

## Umumiy sxema

```
 Mijoz telefoni                    Supabase (bulut)                 Haydovchi telefoni
┌──────────────┐   buyurtma   ┌────────────────────────┐  taklif  ┌──────────────┐
│ customer-app │ ───────────▶ │ Database (Postgres)    │ ───────▶ │  driver-app  │
│  xarita, GPS │              │ Auth (telefon raqam)   │          │ online/offline│
│  pin, buyurtma│ ◀─────────── │ Realtime (jonli)       │ ◀─────── │ joylashuv     │
└──────────────┘  haydovchi   │ Edge Function: dispatch│  qabul   └──────────────┘
                  joylashuvi  └────────────────────────┘
                                         ▲
                                   ┌───────────┐
                                   │   admin   │  haydovchilarni tasdiqlash
                                   └───────────┘
```

## 1. Customer app — `apps/customer-app`

**Nima:** mijoz telefonidagi ilova.
**Holat:** xarita, GPS, markazdagi pin, sputnik rejim, manzilni avtomatik aniqlash — ✅ telefonda ishladi (aniqlik ±20 m).
**Keyin:** telefon raqam bilan kirish, buyurtma yuborish, haydovchini jonli kuzatish, bekor qilish.
**Texnologiya:** Expo + React Native + TypeScript, `react-native-maps`, `expo-location`.

## 2. Driver app — `apps/driver-app` (hali yaratilmagan)

**Nima:** haydovchi telefonidagi ilova.
**Vazifasi:** "Online" tugmasi; online bo'lganda har bir necha soniyada joylashuvini bazaga yuboradi; taklif kelsa 15 soniya ichida qabul yoki rad etadi; mijozgacha navigatsiya; safarni yakunlaydi.

## 3. Database — `supabase/migrations/001_init.sql`

**Nima:** barcha ma'lumot saqlanadigan joy (PostgreSQL + PostGIS).
**Jadvallar:**

| Jadval | Nima saqlaydi |
|---|---|
| `profiles` | Har bir foydalanuvchi: rol (mijoz/haydovchi/admin), ism, telefon |
| `drivers` | Haydovchi: tasdiqlanganmi, online/band, mashina, davlat raqami, **jonli joylashuv** |
| `rides` | Buyurtmalar: kim, qayerdan, qayerga, holat, narx |
| `ride_offers` | Dispatch tarixi: kimga qachon taklif ketdi, nima javob berdi |

**Nega `ride_offers` muhim:** bu kelajakdagi AI dispatcherning "o'quv ma'lumoti". Qaysi haydovchi qancha masofadan rad etadi, qaysi vaqtda qayerda talab ko'p — hammasi shu yerdan o'rganiladi.

## 4. Auth — Supabase Auth

**Nima:** telefon raqam bilan kirish. Foydalanuvchi ro'yxatdan o'tishi bilan `profiles` qatori avtomatik yaratiladi (trigger).
**SMS:** pilotda test rejimi; keyin Eskiz.uz.

## 5. Dispatch — Edge Function (hali yozilmagan) + `nearest_available_drivers()`

**Nima:** Typhoon'ning "miyasi" — buyurtmani kimga berishni hal qiladi.
**Algoritm v1:**
1. Buyurtma kelganda `nearest_available_drivers()` 3 km ichidagi eng yaqin haydovchilarni topadi. Faqat: tasdiqlangan + online + band emas + joylashuvi oxirgi 2 daqiqada yangilangan.
2. Eng yaqiniga 15 soniyalik taklif ketadi.
3. Rad etsa yoki javob bermasa — keyingisiga (bir haydovchiga bitta buyurtma ikki marta taklif qilinmaydi).
4. 3 km da hech kim qolmasa — radius 6 km.
5. Baribir yo'q bo'lsa — mijozga "haydovchi topilmadi".

## 6. Realtime — Supabase Realtime

**Nima:** ilovalar sahifani yangilamasdan o'zgarishni darhol ko'radi: haydovchiga taklif keldi, mijoz haydovchi qabul qilganini va uning mashinasi xaritada harakatlanayotganini ko'radi.

## 7. Xavfsizlik — Row Level Security (RLS)

Har kim faqat o'z ma'lumotini ko'radi:
- Mijoz faqat o'z buyurtmalarini ko'radi; haydovchi ma'lumotini faqat o'z safariga biriktirilgandan keyin ko'radi.
- Haydovchi o'zini "approved" qila olmaydi — faqat online holati va joylashuvini o'zgartira oladi.
- Dispatch maxsus server kaliti bilan ishlaydi.

Bular lokal PostgreSQL'da test qilindi (2026-11-20).

## 8. Admin — `admin/` (pilotda Supabase dashboard)

Pilotda haydovchilarni Supabase dashboard'da qo'lda qo'shish va tasdiqlash. Keyin alohida admin panel: haydovchilar, buyurtmalar, bloklash, statistika.

# Typhoon

Qorako'l (Buxoro viloyati) uchun taxi platformasi. Dispetcher yo'q: mijoz va haydovchi ilova orqali, eng yaqin masofa bo'yicha avtomatik bog'lanadi. Mijoz manzil tushuntirmaydi — GPS uning aniq joyini oladi.

Uzoq muddatli reja: Qorako'l → Buxoro → intercity → butun O'zbekiston; keyin courier va cargo.

## Hozirgi bosqich

**Phase 1 — Qorako'l Taxi MVP.** Batafsil reja va progress: [docs/ROADMAP.md](docs/ROADMAP.md)

## Struktura

```
Typhoon/
├── apps/
│   ├── customer-app/   # Mijoz ilovasi (Expo + React Native + TypeScript)
│   └── driver-app/     # Haydovchi ilovasi (keyinroq)
├── admin/              # Admin panel (React + Vite, keyinroq)
├── supabase/           # Database sxemasi, migrations, Edge Functions (keyinroq)
├── docs/               # Reja, qarorlar, hujjatlar
└── CLAUDE.md           # Claude Code uchun loyiha konteksti
```

## Stack

| Qism | Texnologiya |
|---|---|
| Mobil ilovalar | Expo (React Native) + TypeScript |
| Backend + DB | Supabase (Postgres + PostGIS, Auth, Realtime, Storage) |
| Dispatch | Supabase Edge Functions + pg_cron |
| Admin | React (Vite), Vercel |
| Xarita | Google Maps SDK (oddiy + satellite) |
| SMS | Eskiz.uz |

## Ishga tushirish (customer-app)

```
cd apps/customer-app
npx expo start
```

Telefonda Expo Go orqali QR kodni skanerlang (telefon va kompyuter bitta Wi-Fi'da).

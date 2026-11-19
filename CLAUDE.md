# Typhoon — Claude Code uchun loyiha konteksti

## Loyiha

Qorako'l (Buxoro viloyati, O'zbekiston) uchun taxi platformasi. Dispetcher yo'q: buyurtma avtomatik eng yaqin bo'sh haydovchiga boradi. Mijoz manzil tushuntirmaydi — pickup GPS'dan olinadi, mijoz pinni qo'lda surishi mumkin.

Hozirgi bosqich va progress: `docs/ROADMAP.md`. Har bir qadam tugaganda shu faylni yangilang.

## Egasi haqida

Dilshod — beginner dasturchi (Python asoslari). Windows, VS Code, PowerShell. Javoblar o'zbek tilida, texnik atamalar inglizcha. Har bir buyruqni qayerda va qanday ishga tushirishni aniq ayting. Kod yozganda nima uchun shunday qilinganini qisqa tushuntiring.

## Stack

- Mobil: Expo (React Native) + TypeScript — `apps/customer-app`, `apps/driver-app`
- Backend: Supabase (Postgres + PostGIS, Auth, Realtime, Storage, Edge Functions)
- Admin: React + Vite — `admin/`
- Xarita: Google Maps SDK (react-native-maps)
- SMS: Eskiz.uz

## Qoidalar

- MVP doirasidan chiqmang: faqat Qorako'l ichidagi Economy taxi, naqd to'lov. Intercity/courier/cargo/ML — keyin.
- Bir vaqtda bitta modul. Keyingisiga o'tishdan oldin telefonda test qilinadi.
- Ishlamagan kodni "ishlaydi" demang. Test qilinmagan narsani aniq ayting.
- Maxfiy kalitlar faqat `.env` da, hech qachon git'ga emas. `.env.example` da faqat nomlar.
- Pullik API/servis kerak bo'lsa, oldindan ayting.
- `_old/` papkasi — eski arxiv, unga tegmang.

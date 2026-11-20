# Typhoon — O'quv darslari

Har bir dars Typhoon'ning haqiqiy kodiga asoslangan. Maqsad: kod nima qilishini o'zing tushunadigan bo'lish.

---

## 1-dars: Ma'lumotlar bazasi qanday ishlaydi

**Fayl:** `supabase/migrations/001_init.sql`

### 1.1. Jadval — Excel varag'iga o'xshaydi

```sql
create table public.rides (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  status      ride_status not null default 'searching',
  ...
);
```

- `create table` — yangi "varaq" yaratadi.
- `id uuid primary key` — har bir qatorning takrorlanmas raqami (pasport kabi).
- `references public.profiles (id)` — **bog'lanish**: buyurtmadagi mijoz `profiles` jadvalida albatta mavjud bo'lishi shart. Yo'q mijozga buyurtma yozib bo'lmaydi.
- `not null` — bo'sh qoldirib bo'lmaydi.
- `default 'searching'` — qiymat berilmasa, avtomatik shu yoziladi.

### 1.2. Enum — faqat ruxsat etilgan qiymatlar

```sql
create type ride_status as enum ('searching', 'accepted', 'arrived', ...);
```
Buyurtma holatiga faqat shu so'zlardan biri yoziladi. "serching" kabi xato yozuv baza tomonidan rad etiladi.

### 1.3. Index — kitobning mundarijasi

```sql
create index drivers_location_idx on public.drivers using gist (location);
```
Index bo'lmasa, baza eng yaqin haydovchini topish uchun **hamma** haydovchini birma-bir tekshiradi. Index bilan — darhol topadi. 1000 ta haydovchida farq juda katta.

### 1.4. RLS — kim nimani ko'ra oladi

```sql
create policy "rides: ishtirokchilar ko'radi" on public.rides
  for select using (customer_id = auth.uid() or driver_id = auth.uid());
```
`auth.uid()` — hozir ilovaga kirgan foydalanuvchining id'si. Bu qoida: "buyurtmani faqat uning mijozi yoki haydovchisi ko'radi". Bu xavfsizlik ilovada emas, **bazaning o'zida** — shuning uchun kimdir ilovani buzib so'rov yuborsa ham, begona buyurtmani ololmaydi.

### Mashq
1. `001_init.sql` ni och va `drivers` jadvalini top. Haydovchining qaysi 3 ta ustunini o'zi o'zgartira oladi? (Maslahat: `grant update` qatoriga qara.)
2. Nega haydovchiga `status` ni o'zgartirish ruxsat etilmagan?

---

## 2-dars: Dispatch — Typhoon'ning miyasi

**Fayl:** `supabase/migrations/002_dispatch.sql`

### 2.1. Oqim

```
Mijoz "Taxi chaqirish" bosadi
  → rides jadvaliga yangi qator (status = searching)
  → TRIGGER avtomatik dispatch_next_offer() ni ishga tushiradi
  → eng yaqin bo'sh haydovchiga 15 soniyalik taklif (ride_offers)
  → haydovchi qabul qiladi → status = accepted ✅
     yoki rad etadi / 15 s javob bermaydi → keyingi haydovchi
  → 3 km da hech kim qolmasa → 6 km
  → 6 km da ham yo'q → status = no_driver
```

### 2.2. Trigger — "agar X bo'lsa, avtomatik Y qil"

```sql
create trigger ride_created_dispatch
  after insert on public.rides
  for each row execute function public.on_ride_created();
```
Buyurtma yozilishi bilan dispatch o'zi boshlanadi. Ilova alohida "dispatchni boshla" deb so'rashi shart emas.

### 2.3. `for update` — ikki kishi bir vaqtda

```sql
select * into v_ride from public.rides where id = p_ride_id for update;
```
Ikki haydovchi bir soniyada "Qabul" bossa nima bo'ladi? `for update` qatorni qulflaydi: birinchisi ishini tugatmaguncha ikkinchisi kutadi. Natijada buyurtma faqat bittasiga beriladi, ikkinchisi `too_late` javobini oladi. Bu **race condition** muammosining yechimi.

### 2.4. `security definer` — nazorat ostidagi eshik

Haydovchi `rides` jadvalini o'zi o'zgartira olmaydi (RLS). Lekin `respond_to_offer()` funksiyasini chaqira oladi. Funksiya ichida tekshiruv bor: taklif rostdan unikimi, muddati o'tmaganmi. Ya'ni haydovchi faqat **biz ruxsat bergan yo'l** bilan ishlay oladi.

### 2.5. Test natijalari (2026-11-20)

| Stsenariy | Natija |
|---|---|
| Buyurtma → eng yaqin haydovchi (100 m) ga taklif | ✅ |
| Rad etdi → keyingisi (2 km) | ✅ |
| 15 s javob bermadi → 3 km da hech kim yo'q → 6 km dagi haydovchi | ✅ |
| Rad etgan haydovchi kech "qabul" bosdi → `too_late` | ✅ |
| Qabul → keldi → yo'lda → tugadi; haydovchi yana bo'sh | ✅ |
| Hamma offline → `no_driver` | ✅ |
| Mijoz bekor qildi → taklif yopildi | ✅ |
| Ilova dispatchni o'zi chaqira olmaydi | ✅ |

### Mashq
1. `dispatch_offer_seconds()` funksiyasini top. Taklif vaqtini 20 soniya qilish uchun nimani o'zgartirasan?
2. Nega `nearest_available_drivers()` boshqa taklifga javob kutayotgan haydovchini chetlatadi?

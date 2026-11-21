-- =====================================================================
-- Typhoon — yangi haydovchi qo'shish (admin, Supabase SQL Editor)
--
-- 1) Authentication -> Users -> Add user -> Create new user
--    Email: masalan driver1@typhoon.uz, parol: o'ylab toping, "Auto Confirm User" ✓
-- 2) Yaratilgan foydalanuvchining UID'sini nusxalang
-- 3) Pastdagi qiymatlarni almashtiring va Run bosing
-- 4) Haydovchiga ilova uchun email va parolni bering
-- =====================================================================

update public.profiles
   set role = 'driver',
       full_name = 'Haydovchi ismi',          -- <- almashtiring
       phone = '+998901234567'                -- <- almashtiring
 where id = 'HAYDOVCHI_UID';                  -- <- almashtiring

insert into public.drivers (id, status, car_model, car_color, plate_number)
values ('HAYDOVCHI_UID',                      -- <- almashtiring
        'approved',
        'Cobalt',                             -- <- mashina modeli
        'Oq',                                 -- <- rangi
        '80 A 123 AA')                        -- <- davlat raqami
on conflict (id) do update
  set status = 'approved',
      car_model = excluded.car_model,
      car_color = excluded.car_color,
      plate_number = excluded.plate_number;

-- Tekshirish: barcha haydovchilar ro'yxati
select p.full_name, p.phone, d.status, d.is_online, d.car_model, d.plate_number
  from public.drivers d join public.profiles p on p.id = d.id;

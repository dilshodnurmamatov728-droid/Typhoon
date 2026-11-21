-- =====================================================================
-- Typhoon — 004: narx (taksometr usuli)
-- Safar davomida haydovchi telefoni masofani o'lchaydi; safar tugaganda
-- server narxni tarif bo'yicha hisoblaydi.
-- =====================================================================

-- 1) Tarif: bitta faol qator. Narxni o'zgartirish uchun faqat shu qatorni yangilang.
create table public.tariffs (
  id                   smallint primary key default 1 check (id = 1),
  day_per_km_uzs       integer not null,   -- kunduzi 1 km narxi
  night_per_km_uzs     integer not null,   -- kechasi 1 km narxi
  night_start_hour     smallint not null,  -- kechki tarif boshlanishi (Toshkent vaqti)
  night_end_hour       smallint not null,  -- kechki tarif tugashi
  min_fare_uzs         integer not null,   -- eng kam narx
  round_to_uzs         integer not null default 100,
  updated_at           timestamptz not null default now()
);

insert into public.tariffs (day_per_km_uzs, night_per_km_uzs, night_start_hour, night_end_hour, min_fare_uzs)
values (1100, 1250, 22, 6, 5000);

alter table public.tariffs enable row level security;
create policy "tariffs: hamma ko'radi" on public.tariffs for select using (true);

-- 2) Safar masofasi
alter table public.rides add column distance_m integer;

-- 3) Narx hisoblash
create or replace function public.calculate_fare(p_distance_m integer, p_at timestamptz default now())
returns integer
language sql
stable
as $$
  select greatest(
           t.min_fare_uzs,
           (round(
              (greatest(coalesce(p_distance_m, 0), 0) / 1000.0)
              * case
                  when extract(hour from p_at at time zone 'Asia/Tashkent') >= t.night_start_hour
                    or extract(hour from p_at at time zone 'Asia/Tashkent') <  t.night_end_hour
                  then t.night_per_km_uzs
                  else t.day_per_km_uzs
                end
              / t.round_to_uzs) * t.round_to_uzs)::integer
         )
  from public.tariffs t
  where t.id = 1;
$$;

-- 4) advance_ride endi yakunlashda masofani qabul qiladi va narxni yozadi
drop function public.advance_ride(uuid);

create or replace function public.advance_ride(p_ride_id uuid, p_distance_m integer default null)
returns ride_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_next ride_status;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found or v_ride.driver_id is distinct from auth.uid() then
    raise exception 'Buyurtma topilmadi';
  end if;

  v_next := case v_ride.status
              when 'accepted'    then 'arrived'::ride_status
              when 'arrived'     then 'in_progress'::ride_status
              when 'in_progress' then 'completed'::ride_status
            end;
  if v_next is null then
    raise exception 'Bu holatdan keyingi qadam yo''q: %', v_ride.status;
  end if;

  if v_next = 'completed' then
    update public.rides
       set status = 'completed',
           completed_at = now(),
           distance_m = greatest(coalesce(p_distance_m, 0), 0),
           price_uzs = public.calculate_fare(p_distance_m, now())
     where id = p_ride_id;
    update public.drivers set is_busy = false where id = v_ride.driver_id;
  else
    update public.rides set status = v_next where id = p_ride_id;
  end if;
  return v_next;
end;
$$;

grant execute on function public.advance_ride(uuid, integer) to authenticated;
grant execute on function public.calculate_fare(integer, timestamptz) to authenticated;

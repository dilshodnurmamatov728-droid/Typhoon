-- =====================================================================
-- Typhoon — 006: reyting va haydovchi daromadi
-- =====================================================================

-- 1) Mijoz safardan keyin haydovchiga baho beradi (1–5 yulduz)
alter table public.rides
  add column customer_rating  smallint check (customer_rating between 1 and 5),
  add column customer_comment text,
  add column rated_at         timestamptz;

create or replace function public.rate_ride(p_ride_id uuid, p_stars integer, p_comment text default null)
returns numeric            -- haydovchining yangi o'rtacha reytingi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride   public.rides%rowtype;
  v_avg    numeric;
begin
  if p_stars not between 1 and 5 then
    raise exception 'Baho 1 dan 5 gacha bo''lishi kerak';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found or v_ride.customer_id <> auth.uid() then
    raise exception 'Buyurtma topilmadi';
  end if;
  if v_ride.status <> 'completed' then
    raise exception 'Faqat tugagan safarga baho beriladi';
  end if;
  if v_ride.customer_rating is not null then
    raise exception 'Bu safarga baho berilgan';
  end if;

  update public.rides
     set customer_rating = p_stars,
         customer_comment = nullif(trim(p_comment), ''),
         rated_at = now()
   where id = p_ride_id;

  -- Haydovchi reytingi: oxirgi 100 ta baholangan safar o'rtachasi
  select round(avg(customer_rating)::numeric, 1) into v_avg
    from (select customer_rating from public.rides
           where driver_id = v_ride.driver_id and customer_rating is not null
           order by rated_at desc limit 100) last_rides;

  update public.drivers set rating = v_avg where id = v_ride.driver_id;
  return v_avg;
end;
$$;

-- 2) Haydovchi daromadi: bugun va shu hafta (Toshkent vaqti bo'yicha, dushanbadan)
create or replace function public.driver_earnings()
returns table (today_rides integer, today_uzs bigint, week_rides integer, week_uzs bigint, rating numeric)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('day',  now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent' as day_start,
           date_trunc('week', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent' as week_start
  )
  select
    count(*) filter (where r.completed_at >= b.day_start)::integer,
    coalesce(sum(r.price_uzs) filter (where r.completed_at >= b.day_start), 0)::bigint,
    count(*) filter (where r.completed_at >= b.week_start)::integer,
    coalesce(sum(r.price_uzs) filter (where r.completed_at >= b.week_start), 0)::bigint,
    (select d.rating from public.drivers d where d.id = auth.uid())
  from bounds b
  left join public.rides r
    on r.driver_id = auth.uid() and r.status = 'completed' and r.completed_at >= b.week_start
  group by b.day_start, b.week_start;
$$;

grant execute on function public.rate_ride(uuid, integer, text) to authenticated;
grant execute on function public.driver_earnings() to authenticated;

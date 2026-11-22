-- =====================================================================
-- Typhoon — 007: haydovchi bekor qilishi va "Mijoz chiqmadi"
--  - Haydovchi yo'lda (accepted) bekor qilsa: buyurtma mijozdan olinmaydi,
--    darhol keyingi eng yaqin haydovchiga qayta beriladi.
--  - Haydovchi yetib kelgan (arrived) va mijoz chiqmasa: "Mijoz chiqmadi"
--    bilan yopiladi.
-- =====================================================================

create or replace function public.driver_cancel_ride(p_ride_id uuid, p_reason text default null)
returns text            -- 'redispatched' | 'no_show' | 'cannot_cancel'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
begin
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found or v_ride.driver_id is distinct from auth.uid() then
    raise exception 'Buyurtma topilmadi';
  end if;

  if v_ride.status = 'accepted' then
    -- Shu haydovchining taklifini "rejected" qilamiz: unga qayta taklif bormaydi
    update public.ride_offers
       set status = 'rejected', responded_at = now()
     where ride_id = p_ride_id and driver_id = v_ride.driver_id;

    update public.rides
       set status = 'searching',
           driver_id = null,
           accepted_at = null,
           search_radius_m = 3000,
           cancel_reason = coalesce('Haydovchi bekor qildi: ' || p_reason, 'Haydovchi bekor qildi')
     where id = p_ride_id;

    update public.drivers set is_busy = false where id = v_ride.driver_id;
    perform public.dispatch_next_offer(p_ride_id);
    return 'redispatched';

  elsif v_ride.status = 'arrived' then
    update public.rides
       set status = 'cancelled',
           cancel_reason = 'Mijoz chiqmadi',
           cancelled_at = now()
     where id = p_ride_id;

    update public.drivers set is_busy = false where id = v_ride.driver_id;
    return 'no_show';
  end if;

  return 'cannot_cancel';
end;
$$;

grant execute on function public.driver_cancel_ride(uuid, text) to authenticated;

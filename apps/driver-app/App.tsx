import { Component, ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { supabase, supabaseConfigError, toPoint } from './src/lib/supabase';

const COLORS = {
  black: '#0B0B0C',
  card: '#151517',
  border: '#2A2A2E',
  gold: '#D4AF37',
  white: '#FFFFFF',
  gray: '#9A9A9F',
  green: '#2ECC71',
};

const OFFER_SECONDS = 15;
const QORAKOL = { latitude: 39.5275, longitude: 63.8536, latitudeDelta: 0.03, longitudeDelta: 0.03 };

type Coords = { latitude: number; longitude: number };
type Phase = 'loading' | 'login' | 'not_approved' | 'offline' | 'waiting' | 'offer' | 'ride';
type RideStatus = 'searching' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_driver';
type Ride = {
  id: string;
  status: RideStatus;
  customer_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  pickup_note: string | null;
};
type Offer = { id: number; ride: Ride; distance_m: number | null };
type Earnings = { today_rides: number; today_uzs: number; week_rides: number; week_uzs: number; rating: number | null };
type Tariff = {
  base_fare_uzs: number;
  day_per_km_uzs: number;
  night_per_km_uzs: number;
  night_start_hour: number;
  night_end_hour: number;
  min_fare_uzs: number;
  round_to_uzs: number;
};

const RIDE_FIELDS = 'id, status, customer_id, pickup_lat, pickup_lng, pickup_address, pickup_note';

function MainApp() {
  const mapRef = useRef<MapView>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordsRef = useRef<Coords | null>(null);
  // Taksometr: safar davomida bosib o'tilgan masofa (metr)
  const tripMetersRef = useRef(0);
  const rideStatusRef = useRef<RideStatus | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [myLocation, setMyLocation] = useState<Coords | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
  const [ride, setRide] = useState<Ride | null>(null);
  const [customer, setCustomer] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [tripMeters, setTripMeters] = useState(0);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);

  // ---------------- Kirish ----------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadDriver(data.session.user.id);
      else setPhase('login');
    });
    return () => stopLocationUpdates();
  }, []);

  async function login() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error || !data.user) {
      Alert.alert('Kirib bo\'lmadi', "Login yoki parol noto'g'ri.");
      return;
    }
    loadDriver(data.user.id);
  }

  async function loadEarnings() {
    const { data } = await supabase.rpc('driver_earnings');
    if (Array.isArray(data) && data[0]) setEarnings(data[0] as Earnings);
  }

  async function loadDriver(uid: string) {
    setUserId(uid);
    loadEarnings();
    supabase.from('tariffs').select('*').eq('id', 1).maybeSingle().then(({ data }) => data && setTariff(data as Tariff));
    const { data: d } = await supabase.from('drivers').select('status, is_online').eq('id', uid).maybeSingle();
    if (!d || d.status !== 'approved') {
      setPhase('not_approved');
      return;
    }
    // Tugallanmagan safar bo'lsa, qayta tiklaymiz
    const { data: active } = await supabase
      .from('rides')
      .select(RIDE_FIELDS)
      .eq('driver_id', uid)
      .in('status', ['accepted', 'arrived', 'in_progress'])
      .maybeSingle();
    if (active) {
      await startLocationUpdates(uid);
      setRide(active as Ride);
      setPhase('ride');
      return;
    }
    setPhase('offline');
  }

  async function logout() {
    await goOffline();
    await supabase.auth.signOut();
    setUserId(null);
    setPhase('login');
  }

  // ---------------- Online / joylashuv ----------------
  async function startLocationUpdates(uid: string) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ruxsat kerak', 'Buyurtma olish uchun joylashuvga ruxsat bering.');
      return false;
    }
    stopLocationUpdates();

    // Joylashuvni bazaga yozadi. Dispatch faqat oxirgi 2 daqiqada yangilangan haydovchilarni oladi.
    const sendLocation = async (coords: Coords) => {
      await supabase
        .from('drivers')
        .update({ location: toPoint(coords.latitude, coords.longitude), location_updated_at: new Date().toISOString() })
        .eq('id', uid);
    };

    // Darhol bir marta aniq joyni olamiz
    try {
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: first.coords.latitude, longitude: first.coords.longitude };
      lastCoordsRef.current = coords;
      setMyLocation(coords);
      await sendLocation(coords);
    } catch {
      // keyingi yangilanishda olinadi
    }

    // Haydovchi yursa: har 15 metrda
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        // Taksometr: faqat safar davomida, GPS aniq bo'lsa va keskin "sakrash" bo'lmasa sanaymiz
        const prev = lastCoordsRef.current;
        const accurate = (pos.coords.accuracy ?? 999) <= 50;
        if (rideStatusRef.current === 'in_progress' && prev && accurate) {
          const step = distanceMeters(prev, coords);
          if (step < 500) {
            tripMetersRef.current += step;
            setTripMeters(tripMetersRef.current);
          }
        }
        if (!accurate && prev) return; // noaniq nuqtani o'tkazib yuboramiz
        lastCoordsRef.current = coords;
        setMyLocation(coords);
        sendLocation(coords);
      }
    );

    // Haydovchi bir joyda tursa ham: har 20 soniyada "men shu yerdaman" signali
    heartbeatRef.current = setInterval(() => {
      if (lastCoordsRef.current) sendLocation(lastCoordsRef.current);
    }, 20000);
    return true;
  }

  function stopLocationUpdates() {
    watchRef.current?.remove();
    watchRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }

  async function goOnline() {
    if (!userId) return;
    setBusy(true);
    const ok = await startLocationUpdates(userId);
    if (ok) {
      const { error } = await supabase.from('drivers').update({ is_online: true }).eq('id', userId);
      if (error) Alert.alert('Xato', error.message);
      else setPhase('waiting');
    }
    setBusy(false);
  }

  async function goOffline() {
    stopLocationUpdates();
    if (userId) await supabase.from('drivers').update({ is_online: false }).eq('id', userId);
    setPhase((p) => (p === 'login' ? p : 'offline'));
  }

  // ---------------- Takliflar (Realtime) ----------------
  useEffect(() => {
    if (!userId || (phase !== 'waiting' && phase !== 'offer')) return;
    const channel = supabase
      .channel(`offers-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_offers', filter: `driver_id=eq.${userId}` },
        async (payload) => {
          const o = payload.new as any;
          if (o.status !== 'pending') return;
          const { data: r } = await supabase.from('rides').select(RIDE_FIELDS).eq('id', o.ride_id).maybeSingle();
          if (!r) return;
          setOffer({ id: o.id, ride: r as Ride, distance_m: o.distance_m });
          setSecondsLeft(OFFER_SECONDS);
          setPhase('offer');
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, phase === 'waiting' || phase === 'offer']);

  // Taklif taymeri (server ham 15 s dan keyin keyingi haydovchiga o'tadi)
  useEffect(() => {
    if (phase !== 'offer') return;
    if (secondsLeft <= 0) {
      setOffer(null);
      setPhase('waiting');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  async function respond(accept: boolean) {
    if (!offer) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('respond_to_offer', { p_offer_id: offer.id, p_accept: accept });
    setBusy(false);
    if (error) {
      Alert.alert('Xato', error.message);
      return;
    }
    if (accept && data === 'accepted') {
      setRide({ ...offer.ride, status: 'accepted' });
      setOffer(null);
      setPhase('ride');
    } else {
      if (accept && data === 'too_late') Alert.alert('Kech qoldingiz', 'Bu buyurtma boshqa haydovchiga berildi.');
      setOffer(null);
      setPhase('waiting');
    }
  }

  // ---------------- Faol safar ----------------
  useEffect(() => {
    rideStatusRef.current = ride?.status ?? null;
  }, [ride?.status]);

  useEffect(() => {
    if (!ride?.id) return;
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', ride.customer_id)
      .maybeSingle()
      .then(({ data }) => setCustomer(data ?? null));

    mapRef.current?.animateToRegion(
      { latitude: ride.pickup_lat, longitude: ride.pickup_lng, latitudeDelta: 0.003, longitudeDelta: 0.003 },
      800
    );

    // Mijoz bekor qilsa, darhol bilamiz
    const channel = supabase
      .channel(`driver-ride-${ride.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${ride.id}` },
        (payload) => {
          const n = payload.new as Ride;
          if (n.status === 'cancelled') {
            Alert.alert('Buyurtma bekor qilindi', 'Mijoz buyurtmani bekor qildi.');
            setRide(null);
            setPhase('waiting');
          } else {
            setRide((prev) => (prev ? { ...prev, status: n.status } : prev));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.id]);

  async function advance() {
    if (!ride) return;
    setBusy(true);
    const finishing = ride.status === 'in_progress';
    const { data, error } = await supabase.rpc('advance_ride', {
      p_ride_id: ride.id,
      p_distance_m: finishing ? Math.round(tripMetersRef.current) : null,
    });
    if (error) {
      setBusy(false);
      Alert.alert('Xato', error.message);
      return;
    }
    if (data === 'completed') {
      const { data: done } = await supabase.from('rides').select('price_uzs, distance_m').eq('id', ride.id).maybeSingle();
      setBusy(false);
      Alert.alert(
        'Safar yakunlandi',
        `Masofa: ${formatKm(done?.distance_m ?? 0)}\nMijozdan oling: ${formatSum(done?.price_uzs ?? 0)}`
      );
      setRide(null);
      setCustomer(null);
      setPhase('waiting');
      loadEarnings();
    } else {
      setBusy(false);
      if (data === 'in_progress') {
        tripMetersRef.current = 0; // taksometr noldan boshlanadi
        setTripMeters(0);
      }
      setRide({ ...ride, status: data as RideStatus });
    }
  }

  // Haydovchi bekor qiladi: yo'lda — buyurtma keyingi haydovchiga o'tadi; yetib kelganda — "Mijoz chiqmadi"
  function confirmDriverCancel() {
    if (!ride) return;
    const doCancel = async (reason: string | null) => {
      setBusy(true);
      const { data, error } = await supabase.rpc('driver_cancel_ride', { p_ride_id: ride.id, p_reason: reason });
      setBusy(false);
      if (error) {
        Alert.alert('Xato', error.message);
        return;
      }
      if (data === 'cannot_cancel') {
        Alert.alert("Bekor qilib bo'lmaydi", 'Safar boshlangan.');
        return;
      }
      setRide(null);
      setCustomer(null);
      setPhase('waiting');
    };

    if (ride.status === 'arrived') {
      Alert.alert('Mijoz chiqmadimi?', 'Buyurtma yopiladi va siz yangi buyurtma olishingiz mumkin.', [
        { text: "Yo'q", style: 'cancel' },
        { text: 'Ha, mijoz chiqmadi', style: 'destructive', onPress: () => doCancel(null) },
      ]);
    } else {
      Alert.alert('Buyurtmani bekor qilasizmi?', 'Buyurtma boshqa haydovchiga beriladi.', [
        { text: "Yo'q", style: 'cancel' },
        { text: 'Mashina buzildi', onPress: () => doCancel('mashina buzildi') },
        { text: 'Boshqa sabab', onPress: () => doCancel('boshqa sabab') },
      ]);
    }
  }

  // "Yo'l ko'rsat": Yandex Navigator yoki Google Maps ovozli navigatsiyasi
  function openNavigation(target: Ride) {
    const lat = target.pickup_lat;
    const lng = target.pickup_lng;
    Alert.alert("Yo'l ko'rsatish", 'Qaysi ilova orqali?', [
      {
        text: 'Yandex Navigator',
        onPress: () =>
          Linking.openURL(`yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`).catch(() =>
            Alert.alert('Yandex Navigator topilmadi', "Play Market'dan o'rnating yoki Google Maps'ni tanlang.")
          ),
      },
      {
        text: 'Google Maps',
        onPress: () => {
          const native =
            Platform.OS === 'android'
              ? `google.navigation:q=${lat},${lng}&mode=d`
              : `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
          const web = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
          Linking.openURL(native).catch(() => Linking.openURL(web));
        },
      },
      { text: 'Bekor', style: 'cancel' },
    ]);
  }

  // ---------------- Ko'rinish ----------------
  const shownRide = phase === 'offer' ? offer?.ride : phase === 'ride' ? ride : null;
  const distanceText =
    shownRide && myLocation
      ? `${Math.round(distanceMeters(myLocation, { latitude: shownRide.pickup_lat, longitude: shownRide.pickup_lng }))} m`
      : offer?.distance_m != null
        ? `${offer.distance_m} m`
        : '—';

  if (phase === 'loading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  if (phase === 'login' || phase === 'not_approved') {
    return (
      <KeyboardAvoidingView style={[styles.container, styles.center, { padding: 24 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="light" />
        <Text style={[styles.brand, { marginBottom: 24 }]}>TYPHOON · DRIVER</Text>
        {phase === 'not_approved' ? (
          <>
            <Text style={styles.title}>Akkauntingiz hali tasdiqlanmagan</Text>
            <Text style={[styles.subtitle, { marginVertical: 12 }]}>Admin tasdiqlagandan keyin buyurtma olishingiz mumkin.</Text>
            <Button label="Chiqish" color={COLORS.border} textColor={COLORS.white} onPress={logout} />
          </>
        ) : (
          <View style={{ width: '100%', gap: 10 }}>
            <TextInput style={styles.input} placeholder="Login (email)" placeholderTextColor={COLORS.gray} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Parol" placeholderTextColor={COLORS.gray} secureTextEntry value={password} onChangeText={setPassword} />
            <Button label={busy ? 'Kirilmoqda...' : 'Kirish'} color={COLORS.gold} onPress={login} />
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="hybrid"
        initialRegion={QORAKOL}
        showsUserLocation={phase !== 'offline'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {shownRide && (
          <Marker
            coordinate={{ latitude: shownRide.pickup_lat, longitude: shownRide.pickup_lng }}
            title="Mijoz"
            description={shownRide.pickup_note ?? undefined}
          >
            <View style={styles.pickupPin}>
              <View style={styles.pickupDot} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.topBar}>
        <Text style={styles.brand}>TYPHOON · DRIVER</Text>
        {(phase === 'offline' || phase === 'waiting') && (
          <Pressable style={styles.chip} onPress={logout}>
            <Text style={styles.chipText}>Chiqish</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.sheet}>
        {phase === 'offline' && (
          <>
            <Text style={styles.title}>Siz offline holatdasiz</Text>
            <Text style={styles.subtitle}>Buyurtma olish uchun online bo'ling.</Text>
            {earnings && <EarningsCard e={earnings} />}
            <Button label={busy ? '...' : "Online bo'lish"} color={COLORS.green} onPress={goOnline} />
          </>
        )}

        {phase === 'waiting' && (
          <>
            <View style={styles.row}>
              <ActivityIndicator color={COLORS.gold} />
              <Text style={[styles.title, { flex: 1 }]}>Buyurtma kutilmoqda...</Text>
            </View>
            <Text style={styles.subtitle}>Siz onlinesiz. Joylashuvingiz yangilanib turibdi.</Text>
            {earnings && <EarningsCard e={earnings} />}
            <Button label="Offline bo'lish" color={COLORS.border} textColor={COLORS.white} onPress={goOffline} />
          </>
        )}

        {phase === 'offer' && offer && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>YANGI BUYURTMA</Text>
              <Text style={styles.timer}>{secondsLeft} s</Text>
            </View>
            <Text style={styles.title}>{offer.ride.pickup_address ?? 'Manzil xaritada'}</Text>
            <Text style={styles.subtitle}>
              Sizdan {distanceText}
              {offer.ride.pickup_note ? ` · Izoh: ${offer.ride.pickup_note}` : ''}
            </Text>
            <View style={styles.row}>
              <Button label="Rad etish" color={COLORS.border} textColor={COLORS.white} onPress={() => respond(false)} flex />
              <Button label="Qabul qilish" color={COLORS.gold} onPress={() => respond(true)} flex />
            </View>
          </>
        )}

        {phase === 'ride' && ride && (
          <>
            <Text style={styles.label}>
              {ride.status === 'accepted' ? 'MIJOZ TOMON' : ride.status === 'arrived' ? 'MIJOZ KUTILMOQDA' : 'SAFAR DAVOM ETMOQDA'}
            </Text>
            <Text style={styles.title}>{ride.pickup_address ?? 'Manzil xaritada'}</Text>
            <Text style={styles.subtitle}>
              {customer?.full_name ?? 'Mijoz'} · {distanceText}
              {ride.pickup_note ? ` · ${ride.pickup_note}` : ''}
            </Text>
            <View style={styles.row}>
              {ride.status === 'accepted' && (
                <Button label="Yo'l ko'rsat" color={COLORS.gold} onPress={() => openNavigation(ride)} flex />
              )}
              {customer?.phone && ride.status !== 'in_progress' && (
                <Button label="Qo'ng'iroq" color={COLORS.border} textColor={COLORS.white} onPress={() => Linking.openURL(`tel:${customer.phone}`)} flex />
              )}
            </View>
            {ride.status === 'in_progress' && (
              <View style={styles.meter}>
                <Text style={styles.meterLabel}>TAKSOMETR</Text>
                <Text style={styles.meterValue}>
                  {formatKm(tripMeters)} · {tariff ? formatSum(estimateFare(tripMeters, tariff)) : '—'}
                </Text>
              </View>
            )}
            <Button
              label={busy ? '...' : ride.status === 'accepted' ? 'Keldim' : ride.status === 'arrived' ? 'Safarni boshlash' : 'Safarni yakunlash'}
              color={COLORS.green}
              onPress={advance}
            />
            {(ride.status === 'accepted' || ride.status === 'arrived') && (
              <Pressable onPress={confirmDriverCancel} disabled={busy} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>
                  {ride.status === 'arrived' ? 'Mijoz chiqmadi' : 'Buyurtmani bekor qilish'}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// Sozlamada xato bo'lsa — yopilib qolish o'rniga sababini ko'rsatamiz
export default function App() {
  if (supabaseConfigError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0C', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#D4AF37', fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Sozlama xatosi</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 15 }}>{supabaseConfigError}</Text>
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

// Kutilmagan xato bo'lsa ilova yopilib qolmasdan, xato matnini ekranda ko'rsatadi
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0B0B0C', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#D4AF37', fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Xato yuz berdi</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 14 }} selectable>
            {String(this.state.error?.message ?? this.state.error)}
          </Text>
          <Text style={{ color: '#9A9A9F', fontSize: 12, marginTop: 12 }}>
            Shu ekranni screenshot qilib dasturchiga yuboring.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function EarningsCard({ e }: { e: Earnings }) {
  return (
    <View style={styles.earnings}>
      <View style={styles.earningsCol}>
        <Text style={styles.earningsLabel}>BUGUN</Text>
        <Text style={styles.earningsValue}>{formatSum(e.today_uzs)}</Text>
        <Text style={styles.earningsSub}>{e.today_rides} safar</Text>
      </View>
      <View style={styles.earningsCol}>
        <Text style={styles.earningsLabel}>BU HAFTA</Text>
        <Text style={styles.earningsValue}>{formatSum(e.week_uzs)}</Text>
        <Text style={styles.earningsSub}>{e.week_rides} safar</Text>
      </View>
      <View style={styles.earningsCol}>
        <Text style={styles.earningsLabel}>REYTING</Text>
        <Text style={styles.earningsValue}>★ {e.rating ?? '—'}</Text>
      </View>
    </View>
  );
}

function Button(props: { label: string; color: string; textColor?: string; onPress: () => void; flex?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: props.color, opacity: pressed ? 0.8 : 1 }, props.flex && { flex: 1 }]}
    >
      <Text style={[styles.buttonText, { color: props.textColor ?? COLORS.black }]}>{props.label}</Text>
    </Pressable>
  );
}

// Ekranda ko'rsatish uchun taxminiy narx. Yakuniy narxni server hisoblaydi.
function estimateFare(meters: number, t: Tariff): number {
  const hour = (new Date().getUTCHours() + 5) % 24; // Toshkent vaqti (UTC+5, yozgi vaqt yo'q)
  const night = hour >= t.night_start_hour || hour < t.night_end_hour;
  const perKm = night ? t.night_per_km_uzs : t.day_per_km_uzs;
  const raw = Math.round((t.base_fare_uzs + (meters / 1000) * perKm) / t.round_to_uzs) * t.round_to_uzs;
  return Math.max(t.min_fare_uzs, raw);
}

function formatSum(uzs: number): string {
  return `${uzs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// Ikki nuqta orasidagi to'g'ri chiziqli masofa (metr) — Haversine formulasi
function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 52, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: COLORS.gold, fontSize: 16, fontWeight: '800', letterSpacing: 3, backgroundColor: COLORS.black, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, overflow: 'hidden' },
  chip: { backgroundColor: COLORS.black, borderColor: COLORS.gold, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  pickupPin: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.black, borderWidth: 3, borderColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: COLORS.border, padding: 20, paddingBottom: 34, gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
  label: { color: COLORS.gold, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  timer: { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  title: { color: COLORS.white, fontSize: 19, fontWeight: '700' },
  subtitle: { color: COLORS.gray, fontSize: 14 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: COLORS.white, fontSize: 16 },
  earnings: { flexDirection: 'row', backgroundColor: COLORS.black, borderRadius: 14, padding: 12, gap: 8, marginTop: 4 },
  earningsCol: { flex: 1 },
  earningsLabel: { color: COLORS.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  earningsValue: { color: COLORS.white, fontSize: 15, fontWeight: '800', marginTop: 2 },
  earningsSub: { color: COLORS.gray, fontSize: 12 },
  textButton: { alignItems: 'center', paddingVertical: 10 },
  textButtonLabel: { color: COLORS.gray, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  meter: { backgroundColor: COLORS.black, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.gold },
  meterLabel: { color: COLORS.gold, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  meterValue: { color: COLORS.white, fontSize: 26, fontWeight: '800', marginTop: 4 },
  button: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { fontSize: 16, fontWeight: '800' },
});

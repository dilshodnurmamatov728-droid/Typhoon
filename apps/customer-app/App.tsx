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
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { supabase, supabaseConfigError, toPoint } from './src/lib/supabase';

// Typhoon ranglari: qora, oq, oltin
const COLORS = {
  black: '#0B0B0C',
  card: '#151517',
  border: '#2A2A2E',
  gold: '#D4AF37',
  white: '#FFFFFF',
  gray: '#9A9A9F',
  green: '#2ECC71',
};

// Qorako'l markazi (taxminiy). GPS ishlamasa, xarita shu yerdan ochiladi.
const QORAKOL: Region = {
  latitude: 39.5275,
  longitude: 63.8536,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};
const STREET_ZOOM = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

type Coords = { latitude: number; longitude: number };
type PermissionState = 'loading' | 'granted' | 'denied' | 'blocked';
type RideStatus =
  | 'searching'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_driver';
type Ride = {
  id: string;
  status: RideStatus;
  driver_id: string | null;
  price_uzs?: number | null;
  distance_m?: number | null;
};
type Tariff = { base_fare_uzs: number; day_per_km_uzs: number; night_per_km_uzs: number };
type DriverInfo = {
  car_model: string | null;
  car_color: string | null;
  plate_number: string | null;
  location_lat: number | null;
  location_lng: number | null;
  name: string | null;
  phone: string | null;
};

const ACTIVE_STATUSES: RideStatus[] = ['searching', 'accepted', 'arrived', 'in_progress'];

function MainApp() {
  const mapRef = useRef<MapView>(null);
  const geocodeRequestId = useRef(0);
  const prevDriverRef = useRef<string | null>(null);

  // --- xarita va joylashuv ---
  const [permission, setPermission] = useState<PermissionState>('loading');
  const [pickup, setPickup] = useState<Coords | null>(null);
  const [address, setAddress] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [mapMoving, setMapMoving] = useState(false);
  const [locating, setLocating] = useState(false);

  // --- foydalanuvchi va buyurtma ---
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null }>({
    full_name: null,
    phone: null,
  });
  const [askProfile, setAskProfile] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('+998');
  const [note, setNote] = useState('');
  const [ride, setRide] = useState<Ride | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [rateRide, setRateRide] = useState<{ id: string; price: number; km: string } | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    locateMe();
    signIn();
  }, []);

  // Tarifni bir marta yuklaymiz (narx haqida ma'lumot uchun)
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('tariffs')
      .select('base_fare_uzs, day_per_km_uzs, night_per_km_uzs')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => data && setTariff(data as Tariff));
  }, [userId]);

  // 1) Mijozni avtomatik tanib olish (pilotda SMS va parol yo'q)
  async function signIn() {
    try {
      const { data } = await supabase.auth.getSession();
      let uid = data.session?.user.id ?? null;
      if (!uid) {
        const { data: anon, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        uid = anon.user?.id ?? null;
      }
      setUserId(uid);
      if (!uid) return;

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', uid)
        .maybeSingle();
      if (p) setProfile(p);

      // Ilova yopilib ochilsa, tugallanmagan buyurtmani qayta tiklaymiz
      const { data: active } = await supabase
        .from('rides')
        .select('id, status, driver_id')
        .eq('customer_id', uid)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setRide(active as Ride);
    } catch (e: any) {
      Alert.alert('Serverga ulanib bo\'lmadi', e?.message ?? 'Internetni tekshiring.');
    }
  }

  // 2) Buyurtma holatini jonli kuzatish (Realtime)
  useEffect(() => {
    if (!ride?.id) return;
    const channel = supabase
      .channel(`ride-${ride.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${ride.id}` },
        (payload) => setRide(payload.new as Ride)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.id]);

  // 3) Haydovchi biriktirilganda uning ma'lumoti va jonli joylashuvi
  useEffect(() => {
    const driverId = ride?.driver_id;
    if (!driverId) {
      setDriver(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase
          .from('drivers')
          .select('car_model, car_color, plate_number, location_lat, location_lng')
          .eq('id', driverId)
          .maybeSingle(),
        supabase.from('profiles').select('full_name, phone').eq('id', driverId).maybeSingle(),
      ]);
      if (!cancelled && d) {
        setDriver({ ...d, name: p?.full_name ?? null, phone: p?.phone ?? null });
      }
    })();

    const channel = supabase
      .channel(`driver-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` },
        (payload) => {
          const n = payload.new as any;
          setDriver((prev) =>
            prev ? { ...prev, location_lat: n.location_lat, location_lng: n.location_lng } : prev
          );
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [ride?.driver_id]);

  // Haydovchi yo'lda bekor qilsa: buyurtma qayta qidiruvga tushadi
  useEffect(() => {
    if (ride?.status === 'searching' && prevDriverRef.current) {
      Alert.alert('Haydovchi bekor qildi', 'Sizga boshqa eng yaqin haydovchi qidirilmoqda.');
    }
    prevDriverRef.current = ride?.driver_id ?? null;
  }, [ride?.status, ride?.driver_id]);

  // Yakuniy holatlar uchun xabar
  useEffect(() => {
    if (!ride) return;
    if (ride.status === 'no_driver') {
      Alert.alert('Haydovchi topilmadi', "Hozir yaqin atrofda bo'sh haydovchi yo'q. Birozdan keyin qayta urinib ko'ring.");
      setRide(null);
    } else if (ride.status === 'completed') {
      // Safar tugadi: to'lov summasi va haydovchini baholash ekrani
      setRateRide({ id: ride.id, price: ride.price_uzs ?? 0, km: ((ride.distance_m ?? 0) / 1000).toFixed(1) });
      setStars(5);
      setComment('');
      setRide(null);
    } else if (ride.status === 'cancelled') {
      if ((ride as any).cancel_reason === 'Mijoz chiqmadi') {
        Alert.alert('Buyurtma yopildi', 'Haydovchi sizni kutdi, lekin siz chiqmadingiz.');
      }
      setRide(null);
    }
  }, [ride?.status]);

  // --- Joylashuv ---
  async function locateMe() {
    setLocating(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission(canAskAgain ? 'denied' : 'blocked');
        return;
      }
      setPermission('granted');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setAccuracy(position.coords.accuracy ?? null);
      setPickup(coords);
      lookupAddress(coords);
      mapRef.current?.animateToRegion({ ...coords, ...STREET_ZOOM }, 800);
    } catch {
      Alert.alert('Joylashuv aniqlanmadi', "GPS yoqilganini tekshiring yoki ochiq joyga chiqib qayta urinib ko'ring.");
    } finally {
      setLocating(false);
    }
  }

  async function lookupAddress(coords: Coords) {
    const requestId = ++geocodeRequestId.current;
    setAddress('');
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (requestId !== geocodeRequestId.current) return;
      const place = results[0];
      if (!place) return;
      setAddress(
        [place.street, place.streetNumber, place.district, place.city].filter(Boolean).join(', ')
      );
    } catch {
      // manzil topilmasa ham haydovchi aniq nuqtaga keladi
    }
  }

  function handleRegionChangeComplete(region: Region) {
    setMapMoving(false);
    if (ride) return; // buyurtma ketgandan keyin pickup o'zgarmaydi
    const coords = { latitude: region.latitude, longitude: region.longitude };
    setPickup(coords);
    lookupAddress(coords);
  }

  // --- Buyurtma ---
  async function handleOrder() {
    if (!pickup || !userId) return;
    if (!profile.phone) {
      setNameInput(profile.full_name ?? '');
      setAskProfile(true);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from('rides')
      .insert({
        customer_id: userId,
        pickup: toPoint(pickup.latitude, pickup.longitude),
        pickup_address: address || null,
        pickup_note: note.trim() || null,
      })
      .select('id, status, driver_id')
      .single();
    setBusy(false);
    if (error) {
      Alert.alert('Buyurtma yuborilmadi', error.message);
      return;
    }
    setRide(data as Ride);
  }

  async function saveProfile() {
    const phone = phoneInput.replace(/\s/g, '');
    if (!/^\+998\d{9}$/.test(phone)) {
      Alert.alert("Telefon raqam noto'g'ri", 'Masalan: +998901234567');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: nameInput.trim() || null, phone })
      .eq('id', userId!);
    setBusy(false);
    if (error) {
      Alert.alert('Saqlanmadi', error.message);
      return;
    }
    setProfile({ full_name: nameInput.trim() || null, phone });
    setAskProfile(false);
  }

  async function submitRating() {
    if (!rateRide) return;
    setBusy(true);
    const { error } = await supabase.rpc('rate_ride', {
      p_ride_id: rateRide.id,
      p_stars: stars,
      p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) Alert.alert('Baho yuborilmadi', error.message);
    setRateRide(null);
  }

  function confirmCancel() {
    if (!ride) return;
    Alert.alert('Buyurtmani bekor qilasizmi?', undefined, [
      { text: "Yo'q", style: 'cancel' },
      {
        text: 'Ha, bekor qilish',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('cancel_ride', {
            p_ride_id: ride.id,
            p_reason: 'Mijoz bekor qildi',
          });
          if (error) Alert.alert('Xato', error.message);
          else setRide(null);
        },
      },
    ]);
  }

  // --- Ko'rinish ---
  const driverCoords =
    driver?.location_lat != null && driver?.location_lng != null
      ? { latitude: driver.location_lat, longitude: driver.location_lng }
      : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={satellite ? 'light' : 'dark'} />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={QORAKOL}
        mapType={satellite ? 'hybrid' : 'standard'}
        showsUserLocation={permission === 'granted'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        scrollEnabled={!ride}
        onRegionChange={() => setMapMoving(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {driverCoords && (
          <Marker coordinate={driverCoords} title="Haydovchi">
            <View style={styles.carMarker}>
              <Text style={styles.carMarkerText}>🚕</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Markazdagi pin */}
      <View pointerEvents="none" style={styles.pinWrapper}>
        <View style={[styles.pin, mapMoving && !ride && styles.pinLifted]}>
          <View style={styles.pinHead}>
            <View style={styles.pinDot} />
          </View>
          <View style={styles.pinStem} />
        </View>
        <View style={styles.pinShadow} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.brand}>TYPHOON</Text>
        <Pressable style={styles.chip} onPress={() => setSatellite((s) => !s)}>
          <Text style={styles.chipText}>{satellite ? 'Xarita' : 'Sputnik'}</Text>
        </Pressable>
      </View>

      <View style={styles.sheet}>
        {rateRide ? (
          <>
            <Text style={styles.label}>SAFAR YAKUNLANDI</Text>
            <Text style={styles.title}>
              To'lov: {rateRide.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm (naqd)
            </Text>
            <Text style={styles.subtitle}>Masofa: {rateRide.km} km · Haydovchini baholang</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setStars(n)} hitSlop={8}>
                  <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Izoh (ixtiyoriy)"
              placeholderTextColor={COLORS.gray}
              value={comment}
              onChangeText={setComment}
              maxLength={200}
            />
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => setRateRide(null)}>
                <Text style={styles.secondaryButtonText}>O'tkazib yuborish</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.flex]} onPress={submitRating} disabled={busy}>
                <Text style={styles.primaryButtonText}>Baholash</Text>
              </Pressable>
            </View>
          </>
        ) : permission === 'denied' || permission === 'blocked' ? (
          <>
            <Text style={styles.title}>Joylashuvga ruxsat kerak</Text>
            <Text style={styles.subtitle}>
              Haydovchi sizni aniq topishi uchun ilovaga joylashuvdan foydalanishga ruxsat bering.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={permission === 'blocked' ? () => Linking.openSettings() : locateMe}
            >
              <Text style={styles.primaryButtonText}>
                {permission === 'blocked' ? 'Sozlamalarni ochish' : 'Ruxsat berish'}
              </Text>
            </Pressable>
          </>
        ) : askProfile ? (
          // Birinchi buyurtmada: ism va telefon (haydovchi qo'ng'iroq qilishi uchun)
          <>
            <Text style={styles.label}>Birinchi buyurtma</Text>
            <Text style={styles.title}>Haydovchi siz bilan bog'lanishi uchun</Text>
            <TextInput
              style={styles.input}
              placeholder="Ismingiz"
              placeholderTextColor={COLORS.gray}
              value={nameInput}
              onChangeText={setNameInput}
            />
            <TextInput
              style={styles.input}
              placeholder="+998901234567"
              placeholderTextColor={COLORS.gray}
              keyboardType="phone-pad"
              value={phoneInput}
              onChangeText={setPhoneInput}
            />
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => setAskProfile(false)}>
                <Text style={styles.secondaryButtonText}>Orqaga</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.flex]} onPress={saveProfile} disabled={busy}>
                <Text style={styles.primaryButtonText}>Saqlash</Text>
              </Pressable>
            </View>
          </>
        ) : ride?.status === 'searching' ? (
          <>
            <Text style={styles.label}>BUYURTMA YUBORILDI</Text>
            <View style={styles.row}>
              <ActivityIndicator color={COLORS.gold} />
              <Text style={[styles.title, styles.flex]}>Eng yaqin haydovchi qidirilmoqda...</Text>
            </View>
            <Pressable style={styles.secondaryButtonWide} onPress={confirmCancel}>
              <Text style={styles.secondaryButtonText}>Bekor qilish</Text>
            </Pressable>
          </>
        ) : ride && driver ? (
          <>
            <Text style={styles.label}>
              {ride.status === 'accepted'
                ? 'HAYDOVCHI YO\'LDA'
                : ride.status === 'arrived'
                  ? 'HAYDOVCHI YETIB KELDI'
                  : 'SAFAR DAVOM ETMOQDA'}
            </Text>
            <Text style={styles.title}>
              {[driver.car_color, driver.car_model].filter(Boolean).join(' ') || 'Mashina'} ·{' '}
              {driver.plate_number ?? ''}
            </Text>
            <Text style={styles.subtitle}>{driver.name ?? 'Haydovchi'}</Text>
            <View style={styles.row}>
              {driver.phone && (
                <Pressable
                  style={[styles.primaryButton, styles.flex]}
                  onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                >
                  <Text style={styles.primaryButtonText}>Qo'ng'iroq</Text>
                </Pressable>
              )}
              {ride.status !== 'in_progress' && (
                <Pressable style={styles.secondaryButton} onPress={confirmCancel}>
                  <Text style={styles.secondaryButtonText}>Bekor qilish</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : ride ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <>
            <Text style={styles.label}>Qayerdan olib ketamiz?</Text>
            <Text style={styles.title} numberOfLines={2}>
              {mapMoving ? 'Nuqtani tanlang...' : address || 'Pin turgan joy (xaritani surib aniqlashtiring)'}
            </Text>
            {pickup && (
              <Text style={styles.subtitle}>
                {pickup.latitude.toFixed(6)}, {pickup.longitude.toFixed(6)}
                {accuracy != null ? `  ·  GPS aniqligi ±${Math.round(accuracy)} m` : ''}
              </Text>
            )}
            {tariff && (
              <Text style={styles.subtitle}>
                Narx: {tariff.base_fare_uzs} so'm + 1 km uchun {tariff.day_per_km_uzs} so'm (kechasi{' '}
                {tariff.night_per_km_uzs}) · naqd
              </Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="Izoh (ixtiyoriy): masalan, ko'k darvoza oldida"
              placeholderTextColor={COLORS.gray}
              value={note}
              onChangeText={setNote}
              maxLength={120}
            />
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={locateMe} disabled={locating}>
                {locating ? (
                  <ActivityIndicator color={COLORS.gold} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Mening joyim</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.flex, (!pickup || mapMoving || busy || !userId) && styles.disabled]}
                onPress={handleOrder}
                disabled={!pickup || mapMoving || busy || !userId}
              >
                {busy ? (
                  <ActivityIndicator color={COLORS.black} />
                ) : (
                  <Text style={styles.primaryButtonText}>Taxi chaqirish</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
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

const PIN_HEAD = 34;
const PIN_STEM = 14;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },

  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: PIN_HEAD,
    marginLeft: -PIN_HEAD / 2,
    marginTop: -(PIN_HEAD + PIN_STEM),
    alignItems: 'center',
  },
  pin: { alignItems: 'center' },
  pinLifted: { transform: [{ translateY: -10 }] },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    backgroundColor: COLORS.black,
    borderWidth: 3,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  pinStem: { width: 3, height: PIN_STEM, backgroundColor: COLORS.black },
  pinShadow: { width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: -2 },

  carMarker: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.gold,
    borderWidth: 2,
    borderRadius: 16,
    padding: 4,
  },
  carMarkerText: { fontSize: 18 },

  topBar: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chip: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  chipText: { color: COLORS.white, fontWeight: '600' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
    gap: 8,
  },
  label: { color: COLORS.gold, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  subtitle: { color: COLORS.gray, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 15,
    marginTop: 4,
  },

  row: { flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' },
  flex: { flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  secondaryButtonWide: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: { color: COLORS.white, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginVertical: 6 },
  star: { fontSize: 38, color: COLORS.border },
  starActive: { color: COLORS.gold },
});

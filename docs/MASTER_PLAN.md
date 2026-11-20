# Typhoon — Master Plan (to'liq vizyon)

> Bu fayl Dilshodning asl master planining qisqa, to'liq nusxasi. Hech bir qo'shimcha unutilmasligi uchun shu yerda saqlanadi. Qaysi narsa qaysi bosqichda qilinishi — `ROADMAP.md` da.

## Vizyon

AI-powered transport, mobility, courier va logistika ekotizimi. Brend: tezlik, kuch, jozibadorlik, ilg'or texnologiya. Strategiya: **Qorako'l → Buxoro → intercity → butun O'zbekiston**.

Hal qilinadigan mahalliy muammo: mijozlar 20–30 daqiqa kutadi; yaqinroq haydovchi bo'la turib 1–2 km uzoqdagisi biriktiriladi.

## 1. Typhoon Taxi (birinchi mahsulot)

Tarkibi: customer app, driver app, admin dashboard, backend, database, real-time location, smart dispatch, xarita va navigatsiya, notifications, buyurtmalar boshqaruvi, reyting va fikr-mulohaza, to'lovlar boshqaruvi.

**Customer app:** telefon raqam bilan ro'yxatdan o'tish · GPS joylashuv · xaritada pickup tanlash va pinni qo'lda qo'yish · manzil tanlash · oddiy va sputnik xarita · Qorako'l (keyin Buxoro) uchun batafsil xarita · haydovchini jonli kuzatish · ETA · toifalar: Economy, Comfort/Business, Intercity · haydovchi, mashina, davlat raqami, reyting · safarlar tarixi · bekor qilish va sabablar · mijoz reytingi va shikoyatlar · bildirishnomalar va SMS · avval naqd, keyin online to'lov · juda oddiy interfeys (texnikadan uzoq odamlar uchun ham) · xarita, qidiruv va kelajakda ovoz bilan joy tanlash.

**Driver app:** ro'yxatdan o'tish · hujjat yuklash · admin tasdiqlashi · online/offline · buyurtma bildirishnomalari · qabul/rad etish · pickup va manzilgacha navigatsiya · ovozli yo'l ko'rsatish · mijoz bilan aloqa · safarni yakunlash · kunlik va haftalik daromad · tarix · reyting va statistika · intercity buyurtmalar · kelajakda bonuslar.

## 2. AI Dispatcher — asosiy raqobat ustunligi

Eng mos bo'sh haydovchini topadi (haqiqiy masofa, ETA, bandlik, joylashuv) · rad etilsa keyingisiga avtomatik o'tadi · kutish vaqtini va bo'sh yurishni kamaytiradi · hududlar bo'yicha talabni tahlil qiladi · haydovchilarni talab yuqori joylarga yo'naltiradi · tarixiy ma'lumotdan talabni bashorat qiladi · vaqt o'tishi bilan o'zini yaxshilaydi.
**Qoida:** avval ishonchli algoritm, ML esa yetarli real ma'lumot to'plangandan keyin.

## 3. Boshlang'ich park maqsadi (o'sish maqsadi, 1-kun talabi emas)

70 shahar taxi · 30 kuryer · 20 yuk mashinasi · 20 Qorako'l–Buxoro taxi · 30 Qorako'l–Toshkent taxi. Mavjud haydovchilardan boshlanadi va talabga qarab kengayadi.

## 4. Typhoon Intercity

Yo'nalishlar: Qorako'l ↔ Buxoro, Qorako'l ↔ Toshkent (keyin boshqalar). Yo'nalish tanlash · rejalashtirilgan safarlar · oldindan bron · yo'lovchi sig'imi · yuk ma'lumoti · haydovchi va mashina · bo'sh o'rinlar · bir nechta yo'lovchi · qaytish safarini moslash · bo'sh qaytayotgan haydovchiga yo'lovchi topish · yo'nalishlarni boshqarish.

## 5. Typhoon Courier

Hujjatlar · kichik posilkalar · shaxsiy buyumlar · mahalliy va biznes yetkazib berish · kelajakda ovqat yetkazish. Pickup va manzil · narx · kuryer biriktirish · jonli kuzatish · status · mijoz bilan aloqa · yetkazilganini tasdiqlash.

## 6. Typhoon Cargo

Kichik va katta yuk · mebel · qurilish materiallari · ko'chish · biznes va intercity yuk. Mijoz kiritadi: yuk turi, o'lcham, taxminiy og'irlik, rasm, pickup, manzil, kerakli mashina turi. Platforma mos mashinani topadi.

## 7. Dron yetkazib berish (uzoq muddatli)

Kichik posilka · avtomatik dispatch · marshrut · kuzatish · xavfsiz qo'nish/olish joylari · logistika bilan integratsiya. Faqat qonunchilik, xavfsizlik, infratuzilma va iqtisodiy jihat imkon berganda.

## 8. Biznes model

Taxi, intercity, courier va cargo komissiyalari · biznes hamkorliklar · reklama · premium xizmatlar · korporativ shartnomalar.
Qorako'l uchun real moliyaviy model kerak: haydovchi daromadi, mijoz narxi, komissiya foizi, operatsion xarajatlar, server, marketing, mijoz jalb qilish, break-even, oylik daromad, foyda ssenariylari. **Optimistik raqamlar o'ylab topilmaydi; taxmin va tasdiqlangan ma'lumot ajratib yoziladi.**

## 9. Brend va UI/UX

Professional, premium, zamonaviy; Uber darajasidagi sifat, lekin o'z identiteti. Xususiyatlar: modern, premium, tez, kuchli, texnologik, ishonchli. Ranglar: qora, oq, oltin; toza tipografiya, silliq animatsiyalar, professional xarita, oddiy navigatsiya. Arzon shablonga o'xshamasligi kerak.

**Brend intro:** qora fon, oltin Typhoon logotipi, yorug'lik chaqnashlari, dinamik energiya, tornadoga o'xshash harakat, bog'langan nurlar va zarrachalar.

## 10. Kelajakdagi bosh ofis (uzoq muddatli orzu)

Aylana shakldagi arxitektura · katta landshaft bog' · zamonaviy texnologik dizayn · kuchli vizual identitet.

## 11. Ilovani chiqarish

Android (Google Play) va iOS (App Store). Kerak: ikonlar, screenshotlar, do'kon tavsiflari, privacy policy, terms of service, ruxsatlar, testlash, developer akkauntlar, deploy, backend hosting. Avval yopiq test, keyin ochiq chiqarish.

## 12. Bosqichlar

1. Qorako'l Taxi MVP (architecture → backend → database → auth → customer app → driver app → xarita → joylashuv → buyurtma → driver biriktirish → admin → notifications → test → deploy)
2. Dispatchni yaxshilash, haydovchilarni jalb qilish, Qorako'lda ishga tushirish, real muammolarni tuzatish, marketing
3. Qorako'l–Buxoro va Qorako'l–Toshkent intercity, haydovchi tarmog'ini kengaytirish
4. Courier, Cargo, integratsiyalangan logistika
5. Buxoro shahri, boshqa hududlar, ilg'or AI optimizatsiya, korporativ xizmatlar
6. Dron logistikasini tadqiq qilish va sinash

## Ish tamoyillari

Realistik bo'lish · amalga oshirishga e'tibor · har qadamdan keyin test · ishlamagan narsani "ishlaydi" demaslik · bepul/arzon vositalar · pullik narsalarni oldindan aytish · prototype / MVP / production ni aniq ajratish · Typhoon, freelancing va universitet ishlari aralashtirilmaydi.

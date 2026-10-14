# Responsive Layout & Visual Regression Testing

Farklı ekran boyutlarında elementlerin kayması, üst üste binmesi,
görünmemesi veya etkileşimini kaybetmesi testleri.

## Temel Prensip

Her element her ekran boyutunda görünür, erişilebilir ve etkileşimli
olmalıdır. Boyut değiştirdiğinde element kaybolmamalı, üst üste binmemeli,
diğer elementlerin altına gitmemeli, tıklanabilir olmamalı.

## Test Ekran Boyutları

Her testi bu boyutlarda çalıştır:

| Boyut | Genişlik | Yükseklik | Cihaz |
|-------|----------|-----------|-------|
| Small Mobile | 320px | 568px | iPhone SE |
| Mobile | 375px | 667px | iPhone 8 |
| Large Mobile | 414px | 896px | iPhone XR |
| Tablet Portrait | 768px | 1024px | iPad |
| Tablet Landscape | 1024px | 768px | iPad rotated |
| Small Desktop | 1280px | 720px | HD |
| Desktop | 1440px | 900px | Standard |
| Large Desktop | 1920px | 1080px | Full HD |
| Ultra Wide | 2560px | 1440px | QHD |

## 1. Element Overlapping (Element Üst Üste Binme)

### Tespit Yöntemi

```
Her ekran boyutunda:
1. Tüm interaktif elementleri listele
2. Her elementin bounding box'ını al
3. İki elementin intersection'ını hesapla
4. intersection > 0 ise → overlapping tespit edildi
```

### Yaygın Sorunlar

- Header altındaki hero section header'ı kesiyor
- Floating action button (FAB) alttaki içeriği örtüyor
- Sticky header sayfanın yarısını kaplıyor
- Modal backdrop yerine modal'ın kendisi kaydırılabilir
- Tooltip yanındaki elementin üstüne biniyor
- Dropdown menü altındaki form alanlarını gizliyor

### Test Senaryosu

```
1. Sayfayı 375px genişliğe ayarla
2. Tüm sayfayı scroll et
3. Her interaktif elemente tıkla
4. Her elementin görünürlüğünü kontrol et:
   - Element tamamen görünüyor mu?
   - Başka bir elementin altında mı?
   - Tıklanabilir mi?
   - Başka bir element tarafından engelleniyor mu?
```

## 2. Element Displacement (Element Yer Değiştirme)

### Tespit Yöntemi

```
Her breakpoint'te:
1. Elementlerin x,y koordinatlarını kaydet
2. Boyutu değiştir
3. Yeni koordinatları kaydet
4. Beklenen sıralamayı kontrol et
5. Sıralama değiştiyse → displacement
```

### Yaygın Sorunlar

- Sidebar ana içeriğin üstüne kayıyor
- Butonlar beklenmeyen sırayla dizilmiş
- Form alanları yatay yerine dikey dizilmiş
- Card'lar yatay yerine dikey dizilmiş
- Navigation menüsü collapse olmamış, taşmış

### Test Senaryosu

```
1. Sayfayı 768px (tablet) genişliğine ayarla
2. Tüm elementlerin sırasını kontrol et
3. Beklenen sıralama:
   - Header üstte
   - Navigation header altında
   - Ana içerik ortada
   - Sidebar sağda (varsa)
   - Footer altta
4. Her elementin y ekseni koordinatını kontrol et
5. Sıralama değiştiyse → DEFECT
```

## 3. Element Clipping (Element Kırpılma)

### Tespit Yöntemi

```
Her element için:
1. Elementin gerçek boyutunu al
2. Parent'ının clip boundary'sini al
3. Element parent'ın dışına taşıyor mu?
4. Taşıyorsa → clipped
```

### Yaygın Sorunlar

- Uzun metin taşmış, alttaki satır kesilmiş
- Tablo sütunları görünmüyor
- Form alanları yeterince geniş değil
- Placeholder metin kesilmiş
- Error message taşmış
- Button text kesilmiş
- Image object-fit doğru çalışmıyor

### Test Senaryosu

```
1. Sayfayı 375px'e daralt
2. Tüm text elementlerini kontrol et:
   - Text taşmış mı?
   - Alt satır görünüyor mu?
   - Horizontal scroll var mı?
3. Tüm form alanlarını kontrol et:
   - Label görünüyor mu?
   - Input yeterince geniş mi?
   - Placeholder kesilmiş mi?
4. Tüm tabloları kontrol et:
   - Tüm sütunlar görünüyor mu?
   - Horizontal scroll var mı?
   - Sütun başlıkları görünüyor mu?
```

## 4. Touch Target Sizing (Dokunma Hedefi Boyutu)

### Standartlar

- Minimum touch target: 44x44px (iOS) / 48x48px (Android)
- Minimum spacing: 8px
- Butonlar arası: 8px minimum

### Test Senaryosu

```
1. Tüm interaktif elementlerin boyutunu kontrol et:
   - Buton: 44x44px'den küçük mü?
   - Link: 44x44px'den küçük mü?
   - Input: 44x44px'den küçük mü?
   - Checkbox: 44x44px'den küçük mü?
   - Radio: 44x44px'den küçük mü?
   - Icon button: 44x44px'den küçük mü?

2. Elementler arası mesafeyi kontrol et:
   - İki buton arası 8px'den az mı?
   - Buton ile link arası 8px'den az mı?
```

## 5. Horizontal Overflow (Yatay Taşma)

### Tespit Yöntemi

```
1. Sayfayı 375px'e ayarla
2. document.documentElement.scrollWidth > window.innerWidth kontrol et
3. True ise → horizontal overflow var
4. Hangi element taşıyor?
```

### Yaygın Sorunlar

- Tablo taşmış
- Code block taşmış
- Long text taşmış
- Fixed width element taşmış
- Padding/margin taşmış
- Image taşmış

## 6. Fixed/Sticky Element Behavior

### Test Senaryosu

```
1. Sticky header varsa:
   - Scroll et, header sabit kalıyor mu?
   - Header altındaki içeriği örtüyor mu?
   - Header'daki butonlar tıklanabilir mi?

2. Sticky sidebar varsa:
   - Scroll et, sidebar sabit kalıyor mu?
   - Sidebar ana içeriği örtüyor mu?

3. Floating action button (FAB) varsa:
   - Scroll et, FAB sabit kalıyor mu?
   - FAB alttaki içeriği örtüyor mu?
   - FAB sayfanın sonunda içeriğin üstüne binüyor mu?
```

## 7. Responsive Navigation (Duyarlı Navigasyon)

### Test Senaryosu

```
1. Desktop (1440px):
   - Tüm nav linkleri görünüyor mu?
   - Dropdown'lar çalışıyor mu?

2. Tablet (768px):
   - Nav collapse oldu mu?
   - Hamburger menü görünüyor mu?
   - Hamburger menü açılıyor mu?
   - Menü itemları tıklanabilir mi?

3. Mobile (375px):
   - Nav tamamen collapse oldu mu?
   - Hamburger menü çalışıyor mu?
   - Menü alt sayfaya taşmamış mı?
   - Menü kapatılabiliyor mu?
```

## 8. Form Layout Testing

### Test Senaryosu

```
1. Form alanları yatay mı dikey mi dizilmiş?
   - Desktop: Yatay (label + input yan yana) mı?
   - Mobile: Dikey (label üstte, input altta) mı?

2. Form alanlarının genişliği:
   - Input alanları %100 genişlikte mi?
   - Input alanları taşımış mı?

3. Form submit butonu:
   - Tüm ekran boyutlarında görünüyor mu?
   - Başka elementlerin altında mı?
   - Tıklanabilir mi?

4. Validation mesajları:
   - Tüm ekran boyutlarında görünüyor mu?
   - Taşımış mı?
   - Input alanının altında mı?
```

## 9. Image & Media Responsive

### Test Senaryosu

```
1. Image'lar object-fit doğru çalışıyor mu?
   - Cover: Image kırpılmış mı ama oranı korunuyor mu?
   - Contain: Image tamamen görünüyor mu?

2. Image'lar taşmış mı?
   - Parent container'ın dışına taşıyor mu?

3. Video player:
   - Tüm boyutlarda çalışıyor mu?
   - Kontroller görünüyor mu?
   - Tam ekran yapılabiliyor mu?

4. Background image:
   - Responsive mi?
   - Mobile'da visible mı?
```

## 10. Scroll Behavior

### Test Senaryosu

```
1. Sayfayı baştan sona scroll et:
   - Sticky elementler doğru çalışıyor mu?
   - Scroll smooth mu?
   - Scroll pozisyonu korunuyor mu?

2. Lazy loading:
   - Scroll et, resimler yükleniyor mu?
   - Resimler kaydırırken visible mı?

3. Infinite scroll:
   - Scroll et, yeni içerik yükleniyor mu?
   - Yükleme indicator görünüyor mu?

4. Scroll to element:
   - Link'e tıkla, doğru alana scroll ediyor mu?
   - Sticky header altında doğru pozisyonda mı?
```

## 11. Dark Mode / Theme Testing

### Test Senaryosu

```
1. Dark mode aktifken:
   - Tüm text görünüyor mu?
   - Tüm border görünüyor mu?
   - Tüm icon görünüyor mu?
   - Contrast yeterli mi?
   - Shadow görünüyor mu?

2. Light mode'dan dark mode'a geçiş:
   - Tüm elementler doğru renklere geçti mi?
   - Flash/beyaz ekran var mı?
   - Transition smooth mu?
```

## 12. Orientation Testing

### Test Senaryosu

```
1. Portrait → Landscape geçiş:
   - Layout doğru mu?
   - Elementler yer değiştirdi mi?
   - Sticky elementler doğru çalışıyor mu?

2. Landscape → Portrait geçiş:
   - Layout doğru mu?
   - Elementler yer değiştirdi mi?
   - Scroll pozisyonu korundu mu?
```

## 13. Zoom Testing

### Test Senaryosu

```
1. %100 zoom: Normal durum
2. %150 zoom: Elementler taşımış mı?
3. %200 zoom: Elementler taşımış mı?
4. %50 zoom: Elementler görünüyor mu?
```

## 14. Accessibility at Different Sizes

### Test Senaryosu

```
1. Tüm elementler keyboard ile erişilebilir mi?
2. Focus order doğru mu?
3. Focus indicator görünüyor mu?
4. Screen reader doğru okuyor mu?
```

## Defect Report Formatı

Her responsive defect için:

```markdown
TEST SET ID: TSResponsive_<module>_<seq>
TEST CASE ID: TCResponsive_<module>_<seq>
Title: [Element] [boyut]px'de [sorun]

📋 Steps to Reproduce
1. Sayfayı [boyut]px genişliğine ayarla
2. [adım]
3. [adım]

🖼️ Actual Result
- [Element] [sorun]
- Ekran görüntüsü: [dosya yolu]

🎯 Expected Result
- [Element] görünür, erişilebilir ve etkileşimli olmalı

📎 Ekler / Attachments
- screenshot-[boyut]px-[label].png
```

## Prioritization

1. **Element overlapping** → En yüksek priority (kullanıcı engellenir)
2. **Element clipping** → Yüksek priority (içerik kaybı)
3. **Touch target** → Yüksek priority (mobil kullanılabilirlik)
4. **Horizontal overflow** → Orta priority (kullanıcı deneyimi)
5. **Navigation collapse** → Orta priority (navigasyon engellenir)
6. **Form layout** → Orta priority (form kullanılamaz)
7. **Image responsive** → Düşük priority (görsel sorun)
8. **Scroll behavior** → Düşük priority (deneyim sorunu)

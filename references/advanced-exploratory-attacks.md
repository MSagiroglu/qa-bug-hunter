# Advanced Exploratory Attack Vectors

Senior QA uzmanı perspektifinden gelişmiş keşif test saldırı vektörleri.
Her senaryoyu Phase 1 discovery'de bulunan kısıtlamalara göre filtrele —
boş liste run-producing noise üretir.

## 1. Empty Submission (Sıfır Veri Gönderimi)

Tüm form alanları boş/varsayılan değerlerle submit et. En yüksek yield:
validasyon boşsa, backend'e boş veri gider.

**Uygulama:**
- Form'u hiç dokunmadan Submit/Save/Kaydet butonuna tıkla
- Zorunlu alanları bile boş bırak
- Tarih alanlarını boş, dropdown'ları seçimsiz bırak
- Tüm alanları "" (boş string) ile doldur
- Bazı alanları sadece boşluk ("   ") ile doldur

**Beklenen anormallik:**
- Submit başarılıysa → CONFIRMED DEFECT (backend validasyon eksik)
- Hata mesajı gösterilmiyorsa → CONFIRMED DEFECT (kullanıcı bilgilendirilmiyor)
- Console'da 400/500 varsa →-backend'de validasyon var ama frontend'de yok (yukarıda)
- Toast success ama veri kaydedilmemişse → Ghost Success (High/Critical)

## 2. Existing Data Reproduction (Mevcut Veriyle Hata Tekrarı)

Sistemde halihazırda bulunan verileri kullanarak aynı hataları tekrar
oluştur. Yeni veri üretmek yerine mevcut verileri manipüle et.

**Uygulama:**
- Var olan bir kaydı silmeye çalış (her yerden referansı olan bir kayıt)
- Var olan bir kaydı duplicate isimle güncellemeye çalış
- Silinmiş/deaktif edilmiş bir kaydı referans alan yerlere ekleme yapmaya çalış
- Mevcut kullanıcının email'ini başka bir kullanıcıya atamaya çalış
- Var olan bir ID'yi (API'den bul) kullanarak farklı kullanıcının verisini değiştirmeye çalış (IDOR)
- Sistemdeki ilk kaydı silmeyi dene (bootstrap data / system record)

**Beklenen anormallik:**
- Cascade delete eksikse → orphan records (High)
- Unique constraint yoksa → duplicate data (Critical)
- IDOR varsa → authorization bypass (Critical)
- System record silinebiliyorsa → data integrity (High)

## 3. Type Confusion (Tip Kargaşası)

Her alana beklenmeyen veri tipini gönder. Alan tipini discovery'den al.

**Uygulama:**
- **Sayısal alanlara:** harf, emoji, Unicode, bozuk karakter, SQL fragment
- **Tarih alanına:** sayı, harf, gelecek tarih (100 yıl sonrası), geçmiş tarih (1900 öncesi), "NaN", "undefined"
- **Email alanına:** URL, telefon numarası, sayısı, HTML tag, script tag
- **Dropdown'a:** HTML injection, script injection
- **Boolean alanlara:** "true", "false", 0, 1, "", null, "null"
- **ID alanlarına:** negatif sayı, sıfır, decimal, harf karışımı, "" (boş)

**Beklenen anormallik:**
- Tip dönüşümü hatası → 500 Internal Server Error (High)
- Boolean coercion sorunu → Wrong behavior (Medium/High)
- Null pointer exception → Crash (Critical)
- ID ile 0/negatif → different user's data (Critical - IDOR)

## 4. Duplicate/Existing Data Collision (Veri Çarpışması)

Sistemdeki mevcut verilerle çarpışma testleri.

**Uygulama:**
- Unique alanlara mevcut değerlerden birini gir (email, username, reference code)
- Var olan bir kaydı kendi kendisiyle güncellemeye çalış
- Aynı formu iki ayrı sekmede aç, ikisinde de farklı değerler gir ve ikisini de kaydet
- API ile aynı anda iki kayıt oluştur (race condition)
- Nested/related alanlarda mevcut ID'leri kullan (kötü referans)
- Imported data ile manuel data arasındaki çakışmalar

**Beklenen anormallik:**
- Duplicate key violation → user-visible error (Medium)
- Race condition → lost update (High)
- Stale data overwrite → data loss (High)
- Wrong reference → orphan/broken link (Medium)

## 5. Boundary Edge Cases (Sınır Değer Durumları)

Sıfır, negatif, maksimum, minimum ve예ksik değerler.

**Uygulama:**
- **Sıfır:** Miktar=0, fiyat=0, adet=0, ratio=0
- **Negatif:** Fiyat=-100, adet=-5, oran=-50%
- **Maksimum:** Integer 2^31-1, string max length, array max items
- **Minimum:** 0, 1, -2^31
- **Overflow:** Alan kapasitesinden büyük değer
- **Underflow:** Kapasitenin çok altında değer
- **Decimal precision:** 0.0000001 vs 9999999.9999999

**Beklenen anormallik:**
- Overflow → ArithmeticException / truncated data (High)
- Zero division → 500 error (High)
- Negative price → financial loss (Critical)
- Max+1 → silent truncation (Medium)

## 6. Copy-Paste Attacks (Yapıştırma Saldırıları)

Zengin formatlı yapıştırma içerikleri.

**Uygulama:**
- Word/Excel'den HTML tablolu metin yapıştır
- Rich text editöre RTF içerik yapıştır
- Web sayfasından resimli metin yapıştır
- Excel'den tablo verisini form alanına yapıştır
- Script tag içeren metin yapıştır
- 10.000 karakterlik blok yapıştır
- Yeni satır (\n), tab (\t), carriage return (\r) içeren metin
- Null byte (\0) içeren metin
- Clipboard'dan bozuk/eksik veri yapıştır

**Beklenen anormallik:**
- HTML injection → XSS (Critical)
- Format bozulması → layout break (Medium)
- Script execution → security vulnerability (Critical)
- Null byte → string truncation (High)

## 7. Unicode & Special Character Attacks

Özel karakter ve Unicode testleri.

**Uygulama:**
- Emoji: 😊🔥💀 (özellikle text alanlarında)
- RTL metin: العربية, עברית (yönlendirme testleri)
- Unicode zero-width karakterler: \u200B, \u200C, \u200D
- Combining characters: a + ̃ = ñ (spoofing)
- Normalization: café vs café (farklı encoding)
- Surrogate pairs: 😀 (4 byte UTF-16)
- Null characters: \u0000
- Line breaks: \r\n vs \n vs \r
- Tab characters: \t
- Backspace: \b
- Form feed: \f

**Beklenen anormallik:**
- Encoding error → garbled text (Medium)
- Injection → XSS (Critical)
- Normalization bypass → duplicate with different representation (Medium)
- Null byte → truncation (High)

## 8. Concurrent Access (Eşzamanlı Erişim)

Aynı anda birden fazla kullanıcı/istemci erişimi.

**Uygulama:**
- Aynı kaydı iki farklı sekmede/tarayıcıda aç ve ikisini de güncelle
- API ile同一 anda create delete yap
- Kullanıcı rolünü değiştirirken aynı anda veri erişimi
- Import işlemi devam ederken aynı tabloyu sorgula
- Batch operation devam ederken aynı kayıtları tekil olarak değiştir
- Transactionmarine dead-lock testleri (iç içe başlangıçlar)

**Beklenen anormallik:**
- Lost update → data loss (High)
- Deadlock → application hang (High)
- Race condition → inconsistent state (High)
- Stale read → wrong decision (Medium)

## 9. Cache Staleness (Önbellek Eski Veri)

Önbellekte kalan eski verilerle test.

**Uygulama:**
- Veriyi güncelle, farklı sekmede hemen kontrol et (cache invalidation)
- Back-end'de veriyi değiştir, frontend'i yenilemeden kontrol et
- List sayfasında cache'i bypass etmeden filtreleme yap
- Dashboard'da gerçek zamanlı veri beklenen yerlerde cache'li veri gösterme
- LocalStorage/SessionStorage'da eski veri kalması
- Service Worker cache'i hala eski veri tutması
- CDN cache'i hala eski dosya sunması
- Browser cache'i hala eski CSS/JS sunması
- API response cache'i (ETag, If-None-Match) hala eski veri döndürmesi

**Beklenen anormallik:**
- Stale cache → wrong data displayed (High)
- Cache poisoning → persistent wrong data (Critical)
- Invalidation failure → permanent stale data (High)

## 10. Browser Navigation (Tarayıcı Gezinme)

Back/Forward, refresh, multi-tab senaryoları.

**Uygulama:**
- Formu doldur, Back butonuna bas
- Submit sonrası Back butonu → tekrar submit eder mi?
- Forward butonu → tekrar submit eder mi?
- Sayfayı refresh et (F5) → form verileri korunuyor mu?
- Hard refresh (Ctrl+F5) → cache temizleniyor mu?
- Sekmeyi kapat, yeniden aç → state korunuyor mu?
- Multi-tab'da aynı sayfayı aç → iki tab'da farklı işlemler yap
- Form doldur, farklı bir link'e tıkla → confirmation dialog çıkıyor mu?
- 404 sayfasından Back → uygulama doğru state'e dönüyor mu?
- Deep link ile uygulamaya gir → doğru state'e ulaşıyor mu?

**Beklenen anormallik:**
- Double submit → duplicate data (High)
- State loss → data loss (Medium)
- No confirmation → accidental navigation (Medium)
- Deep link bypass → auth/state bypass (High)

## 11. File Upload Edge Cases

Dosya yükleme testleri.

**Uygulama:**
- Boş dosya (0 byte)
- Çok büyük dosya (>10MB)
- Yanlış dosya uzantısı (image alanına .exe)
- Dosya uzantısı spoofing (image.exe.jpg)
- Path traversal in filename: ../../etc/passwd
- Unicode in filename: resim Dosyası.jpg
- Symlink upload
- Double extension: image.php.jpg
- Content-type mismatch: .txt dosyasını image olarak yükle
- Birden fazla dosya aynı anda
- Upload iptal et
- Upload devam ederken sayfayı yenile

**Beklenen anormallik:**
- Path traversal → file write (Critical)
- Content-type mismatch → security bypass (High)
- Large file → DoS (High)
- Empty file → null reference (Medium)

## 12. API Contract Violations (API Sözleşme İhlalleri)

API'yi sözleşmeye aykırı kullanma.

**Uygulama:**
- Zorunlu alanları eksik gönder
- Fazla alan gönder (unknown fields)
- Yanlış tipte değerler (string yerine array)
- Null değer gönder (boşluksuz)
- Empty string yerine null
- Çok büyük değerler
- Bozuk JSON
- Bozuk header'lar
- Wrong Content-Type
- Missing Authorization header
- Expired token
- Wrong HTTP method (GET yerine POST)
- Query string injection

**Beklenen anormallik:**
- Unhandled exception → 500 (High)
- Data corruption → wrong data persisted (Critical)
- Auth bypass → unauthorized access (Critical)
- Information leakage → error message exposure (Medium)

## 13. State Machine Attacks (Durum Makinesi Saldırıları)

Geçersiz durum geçişleri.

**Uygulama:**
- Published bir kaydı Draft'a geri al
- Approved bir kaydı reddet
- Closed bir kaydı reopen et
- Deleted bir kaydı restore et (eğer varsa)
- Pending bir kaydı complete et (intermediate step atlama)
- Aynı anda iki farklı geçiş yap (double-click race condition)
- Stale state ile geçiş yap (başka kullanıcı değiştirdi)
- Transition'ı canceldan sonra tekrar dene
- Invalid combination: status + action combinations

**Beklenen anormallik:**
- Invalid transition → data corruption (High)
- Race condition → inconsistent state (High)
- Stale state → wrong state (Medium)
- Missing validation → invalid workflow (Medium)

## 14. Internationalization & Localization Edge Cases

Çeviri ve yerelleştirme testleri.

**Uygulama:**
- En uzun çeviriyi kullan (button text overflow test)
- RTL diline geç → layout tamamen ters döndü mü?
- Sayısal format: 1.000,00 vs 1,000.00
- Tarih formatı: DD/MM/YYYY vs MM/DD/YYYY
- Para birimi: $100 vs 100€ vs ¥100
- Sıfır çoğul: "0 items" vs "1 item" vs "2 items"
- Çeviri eksik: anahtar kelime görünüyor mu?
- Karakter seti: Latin1, UTF-8, ASCII
- Timezone farklılıkları
- DST geçiş tarihleri
- Takvim sistemi: Miladi vs Hicri vs Japon
- Birim dönüşümü: metric vs imperial

**Beklenen anormallik:**
- Text overflow → layout break (Medium)
- Wrong format → misinterpretation (High)
- Missing translation → raw key visible (Low)
- Timezone error → wrong date (High)

## 15. Accessibility Attack Patterns (Erişilebilirlik Saldırıları)

Erişilebilirlik testlerini derinleştirme.

**Uygulama:**
- Focus trap: Tab ile modal'dan çık
- Focus restoration: Modal kapatılınca focus eski yerine dönsün
- Screen reader: Tüm interaktif elemanlar label'lı mı?
- Keyboard: Tüm operasyonlar sadece keyboard ile yapılabilir mi?
- Color contrast: Text ve background arası yeterli kontrast var mı?
- Alt text: Tüm resimler anlamlı alt text'e sahip mi?
- ARIA: Tüm interaktif elemanlar doğru ARIA rollerine sahip mi?
- Skip link: Ana içeriğe geçiş linki var mı?
- Heading hierarchy: H1 → H2 → H3 sıralaması doğru mu?
- Landmark: Sayfa yapısı doğru landmark'lara sahip mi?
- Motion: Animation kapatılabilir mi? (prefers-reduced-motion)
- Zoom: Sayfa %200 zoom'da bozuluyor mu?

**Beklenen anormallik:**
- Focus trap → keyboard-only users trapped (High)
- Missing label → screen reader unusable (High)
- Low contrast → visually impaired unusable (Medium)
- No keyboard access → motor impaired unusable (High)

## Prioritization (Önceliklendirme)

Bu atak vektörlerini çalıştırırken öncelik sırası:

1. **Boş submit + existing data** → En hızlı, en yüksek yield
2. **Type confusion** → Hızlı, yüksek defect detection rate
3. **API contract violations** → Backend validasyon gap'lerini bulur
4. **Race condition/concurrent** → Kritik, zor reproduced
5. **Copy-paste/Unicode** → Security adjacent
6. **Cache staleness** → Zaman alıcı, yüksek价值
7. **Browser navigation** → Zaman alıcı, orta价值
8. **State machine** → Domain-specific, yüksek价值
9. **i18n** → Domain-dependent
10. **Accessibility** → Her zaman çalıştırılmalı
11. **File upload** → Domain-dependent

## Execution Notes

- Her atak vektörünü **sadece** Phase 1'de bululan kısıtlamalara göre uygula
- Boş alan testi: tüm formlarda çalıştırılmalı (herhangi bir özel kısıtlama gerekmez)
- Mevcut veri testi: veritabanına erişim varsa更强更强更强更强
- Race condition: timing'e bağlı, birden fazla deneme gerekebilir
- Her bulguyu investigation sonrası sınıflandır
- Oracle belirt: hangi seviye ile test ettin

## Completion Checklist Integration

Her run'da şunları kontrol et:
- [ ] Tüm formlarda empty submit testi yapıldı
- [ ] Mevcut verilerle çakışma testleri yapıldı
- [ ] Sayısal alanlara tip dışı değerler girildi
- [ ] API contract ihlalleri test edildi
- [ ] Race condition testleri yapıldı (varsa write operation)
- [ ] Copy-paste senaryoları test edildi
- [ ] Unicode testleri yapıldı
- [ ] Browser navigation testleri yapıldı

# Backend Injection & Manipulation Testing

> **KAPSAM UYARISI — AKTİF GÜVENLİK TESTİ VARSAYILAN QA KAPSAMI DIŞINDADIR.**
> Bu dosyanın enjeksiyon, XXE, path traversal ve kimlik doğrulama atlatma
> bölümleri yalnızca **yazılı yetkiyle**, **sahibi olduğunuz, paylaşımlı
> olmayan** bir hedefte uygulanır. Paylaşımlı/stage ortamlarda yapılmaz.
> Varsayılan duruş **saldırmadan tespit etmektir**: tek bir zararsız meta
> karakter gönder, hata sızıntısını ve yansımayı gözle, kanıtı dosya olarak
> kaydet (`references/core/evidence-capture.md`, `references/core/security-hygiene.md`).
> Hazır exploit dizgisi bu dosyada tutulmaz; derin güvenlik testi için ayrı bir
> yetkili pentest çalışması yürütülür (OWASP WSTG, ASVS, API Security Top 10).

Sadece ön yüz değil, arka yüz (backend) de test edilir. Frontend'den
gönderilen değerlerin backend'de nasıl işlendiğini, manipulated edildiğinde
ne olduğunu test eder.

## Temel Prensip

Frontend validation bir lastik banttır — her zaman kırılabilir. Backend
validation ise gerçektir. Bu testler frontend bypass edilerek backend'in
kendi başına ne kadar dayanıklı olduğunu ölçer.

## 1. Direct API Manipulation (API Doğrudan Manipülasyonu)

Frontend'i tamamen atlayarak API'ye doğrudan istek gönder.

### 1.1 Boş/Gönderilmemiş Değerler

```
Frontend'de: formu doldur → submit
Backend test: API'ye boş body gönder
Backend test: Zorunlu alanları eksik gönder
Backend test: Tüm alanları null olarak gönder
Backend test: Alan adlarını hiç gönderme (field omission)
Backend test: "" (empty string) vs null olarak gönder
```

**Beklenen:** Backend 400/422 döndürmeli, 201 başarı olmamalı
**Anormallik:** 201 başarı döndüyse → backend validasyon eksik (Critical)

### 1.2 Tip Manipülasyonu

```
Sayısal alanlara:
  - "abc" (string)
  - "12.34" (decimal → integer alana)
  - "1e10" (scientific notation)
  - "0x1A" (hex)
  - "Infinity", "NaN"
  - "" (empty string → integer)
  - null
  - true/false (boolean → integer)
  - [] (array → scalar)
  - {} (object → scalar)

Tarih alanlarına:
  - "abc" (string)
  - "2024-13-01" (geçersiz ay)
  - "2024-02-30" (geçersiz gün)
  - "2024-00-00" (sıfır)
  - "9999-12-31" (çok uzak gelecek)
  - "1900-01-01" (çok uzak geçmiş)
  - 1234567890 (timestamp → date string)
  - true/false

Boolean alanlara:
  - "true" (string → boolean)
  - "1", "0" (number → boolean)
  - "yes", "no" (string → boolean)
  - null
  - ""
  - [] (array)
  - {} (object)

Email alanlara:
  - "" (empty)
  - "notanemail" (no @)
  - "@domain.com" (no local part)
  - "user@" (no domain)
  - "user@.com" (dot start)
  - "user@domain" (no tld)
  - "user space@domain.com" (space)
  - "user@domain.com\n<script>" (injection)
  - very long string (10000+ chars)

ID alanlara:
  - "0" (zero)
  - "-1" (negative)
  - "99999999999" (non-existent)
  - tek bir tırnak karakteri `'` (yalnızca hata sızıntısını gözlemlemek için)
  - null
  - ""
  - true/false
  - [] (array → scalar)
```

### 1.3 Field Overposting (Fazla Alan Gönderimi)

API'ye beklenenden fazla alan gönder — mass assignment testi.

```
Normal: { "name": "test", "email": "test@test.com" }
Manipüle: { "name": "test", "email": "test@test.com", "role": "admin", "isVerified": true, "credit": 999999 }
```

**Beklenen:** Fazla alanlar yok sayılmalı
**Anormallik:** Fazla alanlar kaydedildiyse → mass assignment (Critical)

### 1.4 Field Underposting (Eksik Alan Gönderimi)

```
Normal: { "name": "test", "email": "test@test.com", "phone": "123" }
Manipüle: { "name": "test" }  // email ve phone eksik
```

**Beklenen:** Backend 400/422 döndürmeli
**Anormallik:** 201 başarı döndüyse → eksik veri kaydedildi (High)

### 1.5 IDOR (Insecure Direct Object Reference)

```
Kullanıcı A → /api/users/123/profile (kendi profili)
Kullanıcı A → /api/users/456/profile (başkasının profili)
Kullanıcı A → /api/users/0/profile (sıfır)
Kullanıcı A → /api/users/-1/profile (negatif)
Kullanıcı A → /api/users/9999999/profile (olmayan)
```

**Beklenen:** 403 Forbidden veya 404 Not Found
**Anormallik:** 200 OK + başka kullanıcının verisi → IDOR (Critical)

## 2. SQL Injection Patterns (SQL Injection Kalıpları)

**Kapsam:** Aktif enjeksiyon bu dosyada çalıştırılabilir adım olarak tutulmaz
(bkz. üstteki uyarı). QA'nın yaptığı yalnızca tespittir.

### Saldırmadan tespit (Detection without exploitation)

- Sorgu parametreli mi? İşaretler: tek bir tırnak `'` gönderilince ham veritabanı
  hata metni, yığın izi veya sorgu parçası dönüyor mu?
- Aynı alana tek bir zararsız meta karakter (örn. `'` ya da `"`) gönder; yanıt
  kodunu ve gövdeyi **dosya olarak** kaydet. Bu hata sızıntısı bulgusudur
  (Medium), enjeksiyonun varlığının kanıtı değildir.
- Sayısal alanlara tür dışı değer (harf, çok büyük sayı) gönder; 500 ve ham hata
  metni sızıntısına bak (`security-hygiene.md`).
- Zaman tabanlı, veri çeken veya tablo değiştiren denemeler **yapılmaz**.

### Standartlar (Standards)

OWASP WSTG (input validation testing), OWASP ASVS (input handling), OWASP API
Security Top 10. Madde numarası bu repoda doğrulanmadığı için verilmez.

## 3. XSS (Cross-Site Scripting) Testleri

**Detaylı payload listesi için `references/lenses/web/xss-attack-patterns.md` dosyasına bak.**

### 3.1 Stored XSS

```
Name: <script>alert('XSS')</script>
Comment: <img src=x onerror=alert('XSS')>
Bio: <svg onload=alert('XSS')>
Title: javascript:alert('XSS')
Username: <script>alert(document.cookie)</script>
```

**Beklenen:** Script.execute edilmemeli, escape edilmeli
**Anormallik:** Alert çıktıysa → Stored XSS (Critical)

### 3.2 HTML Injection - Buton ve Link Oluşturma

```
Comment: <button onclick="alert('Hacked')">Click</button>
Comment: <a href="http://attacker.example.test">Click</a>
Comment: <div onclick="alert('XSS')">Click</div>
Comment: <form action="http://attacker.example.test"><input type="submit"></form>
Comment: <iframe src="http://attacker.example.test/phish"></iframe>
```

**Beklenen:** HTML tag'leri escape edilmeli, render edilmemeli
**Anormallik:** Buton visible ve tıklanabilir → HTML Injection (Critical)

### 3.3 Reflected XSS

```
URL: /search?q=<script>alert('XSS')</script>
URL: /page?id="><script>alert('XSS')</script>
URL: /user?name=<img src=x onerror=alert('XSS')>
```

### 3.4 DOM-based XSS

```
Input: #<script>alert('XSS')</script>
Input: "><img src=x onerror=alert('XSS')>
Input: javascript:alert('XSS')
```

### 3.5 XSS via API Manipulation

```
POST /api/users
{
  "name": "<script>alert('XSS')</script>",
  "bio": "<img src=x onerror=alert(document.cookie)>",
  "website": "javascript:alert('XSS')"
}
```

**Beklenen:** API payload'ı escape etmeli veya red etmeli
**Anormallik:** Kaydedildiyse → Backend XSS (Critical)

## 4. NoSQL Injection

**Kapsam:** Operatör enjeksiyonu aktif güvenlik testidir; yukarıdaki uyarı
geçerlidir. Tespit: alanlara nesne/dizi gibi beklenmeyen tipler göndermek yerine,
API sözleşmesine aykırı tipin (string yerine nesne) temiz bir 400 ile
reddedildiğini gözle (bkz. §1.2). Yetkili aktif test için OWASP WSTG ve API
Security Top 10'a bak.

## 5. XXE (XML External Entity) Testleri

**Kapsam:** Aktif güvenlik testi; yetkisiz ortamda yapılmaz. Tespit: XML kabul
eden bir uç varsa yalnızca bunu not et ("XML ayrıştırıcı var") ve ayrı bir
yetkili güvenlik çalışmasına bırak. Hazır entity yükleri bu dosyada tutulmaz.

## 6. Path Traversal

**Kapsam:** Aktif güvenlik testi. Tespit: dosya adı/yolu alan parametrede
kendi yüklediğin dosyanın adını değiştirip beklenen davranışı (reddet veya
temizle) gözle; sistem dosyalarına erişmeyi **deneme**. Dosya adı doğrulaması
için `references/core/input-mutation-catalog.md`'deki güvenli mutasyonları kullan.

## 7. HTTP Header Injection

```
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
Client-IP: 127.0.0.1
X-Forwarded-Host: attacker.example.test
X-Forwarded-Proto: https
```

**Beklenen:** Bu header'lar güvenilir kaynaktan gelmeli
**Anormallik:** IP spoofing yapılabiliyorsa → Auth bypass (High)

## 8. Content-Type Manipulation

```
Normal: Content-Type: application/json
Manipüle: Content-Type: text/xml (XML entity ile)
Manipüle: Content-Type: application/x-www-form-urlencoded (paramtere pollution)
Manipüle: Content-Type: multipart/form-data (file upload trick)
```

## 9. Response Manipulation Testleri

Backend'in döndüğü response'ları manipüle ederek frontend'i kandırma.

### 9.1 Response Body Manipulation

```
API Response: { "success": true, "data": {...} }
Frontend: success=true olduğuna güveniyor
Manipüle: Response'u intercept et → success=true yap
```

### 9.2 Status Code Manipulation

```
API: 401 Unauthorized
Manipüle: 200 OK yap
Frontend: 200 OK görünce veri gösteriyor mu?
```

### 9.3 Header Manipulation

```
API: Set-Cookie: session=abc123
Manipüle: session=DIFFERENT_VALUE
```

## 10. Race Condition API Testing

Eşzamanlı API istekleri ile veri tutarsızlığı.

```
Thread 1: POST /api/transfer {from: A, to: B, amount: 100}
Thread 2: POST /api/transfer {from: A, to: C, amount: 100}
Sonuç: A'dan 200 çekilmeli mi? İkisi de başarısız olmalı mı?
```

```
Thread 1: PUT /api/users/123/role {role: "user"}
Thread 2: PUT /api/users/123/role {role: "admin"}
Sonuç: Son hangisi geçerli olmalı?
```

## 11. Authentication Bypass Patterns

**Kapsam:** Yetkisiz erişimi zorlama aktif güvenlik testidir. QA'nın güvenli
karşılığı: **kendi** iki test kullanıcısıyla yetki sınırlarını yoklamak
(`references/core/authz-matrix.md`, `references/core/api-ui-crosscheck.md`):
oturumsuz, süresi dolmuş veya boş oturumla bir uca gidildiğinde 401/403 dönmesi
beklenir; 200 dönmesi bir **aday bulgudur** — oracle ile doğrula, sonra raporla.

## 12. Session Management

```
Session fixation: Kullanıcı login olmadan önceki session ID'si hala geçerli mi?
Session hırsızlığı: Başka kullanıcının session ID'si ile erişim
Concurrent sessions: Aynı anda birden fazla aktif session
Session timeout: Süre dolduğunda token hala çalışıyor mu?
Logout: Token iptal edildi mi? Eski token hala çalışıyor mu?
```

## Frontend-Backend Uyum Kontrolü

Her test senaryosunda hem frontend hem backend yanıtını karşılaştır.

### Senaryo: Boş Form Submit

```
1. Frontend'de formu boş bırak ve submit et
   - Frontend yanıtını kaydet: hata mesajı gösterdi mi?
   - Network tab'dan API yanıtını kaydet: status code, body

2. API'ye doğrudan boş body gönder
   - API yanıtını kaydet: status code, body

3. Karşılaştır:
   - Frontend hata mesajı gösteriyor mu?
   - Backend aynı hata mesajını döndürüyor mu?
   - İkisi de aynı mı? Farklıysa → VALIDATION GAP
```

### Senaryo: Tip Manipülasyonu

```
1. Frontend'de sayısal alana metin gir ve submit et
   - Frontend ne yaptı? Red mi etti?
   - API'ye ne gönderildi? Frontend transform etti mi?

2. API'ye doğrudan string değer gönder (number field'e)
   - API ne yaptı? 400 mü döndürdü?

3. Karşılaştır:
   - Frontend ve Backend aynı ret tepkisini veriyor mu?
   - Farklıysa → DIVERGENT VALIDATION (potansiyel defect)
```

### Senaryo: IDOR Testi

```
1. Kullanıcı A ile Kullanıcı B'nin API yanıtını kaydet
2. Kullanıcı A token'ı ile Kullanıcı B'nin verisine istek at
   - Backend ne döndürdü?
3. Kullanıcı B token'ı ile Kullanıcı A'nın verisine istek at
   - Backend ne döndürdü?
4. Karşılaştır:
   - Her iki taraf da 403 döndürdü mü?
   - Döndürmediyse → IDOR (Critical)
```

## Test Senaryosu Şablonu

Her backend testi için şu formu kullan:

```markdown
### Backend Test: [Test Adı]

**Hedef:** [API endpoint]
**Metot:** [GET/POST/PUT/DELETE]
**Payload:**
```json
{ "manipulated_data" }
```

**Frontend Davranışı:**
- Ne gördü: [hata mesajı / success / nothing]
- Ne yaptı: [submit etti / reddetti / crash]

**Backend Davranışı:**
- Status Code: [200/400/403/404/500]
- Response Body: [kayıt]
- DB Durumu: [değişiklik var mı?]

**Uyum Kontrolü:**
- Frontend ve Backend uyumlu mu? [Evet/Hayır]
- Fark varsa: [açıklama]

**Sonuç:** [PASS/FAIL/POTENTIAL_DEFECT]
```

## Prioritization

1. **Empty body/field omission** → En hızlı, en yüksek yield
2. **IDOR** → En kritik, often overlooked
3. **Type confusion** → Hızlı, high detection rate
4. **SQL/NoSQL injection** → Critical if exists
5. **Mass assignment** → Common in new APIs
6. **Race condition** → Hard to reproduce, high impact
7. **Auth bypass** → Critical if exists
8. **Response manipulation** → Frontend trust issues

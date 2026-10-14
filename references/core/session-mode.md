# Session Modu (Charter Tabanlı Keşif)

Sweep varsayılan moddur. Session modu, tek bir charter etrafında zaman kutulu, hipotez odaklı keşif oturumudur. Çağrı: `/senior-qa-explorer session "<charter>"` (isteğe bağlı kısayol: `/qa-session "<charter>"`, bkz. `extras/claude-commands/`).

## Charter formülü

```
Keşfet <alan>
Şununla <kaynak / teknik>
Bulmak için <bilgi / risk>
```

Örnek: "Keşfet sipariş iptal akışını / Şununla ağ kesintisi ve çift tıklama / Bulmak için çift iptal veya yetim kayıt riskini."

Kurallar:
- Tek charter = tek alan. Birden fazla alan varsa böl, `charters-backlog.md`'ye yaz.
- "Bulmak için" kısmı ölçülebilir bir bilgi sorusu olmalı ("her şeyi test et" geçersiz).
- Şablonlar ve örnekler: `templates/charter.md`.

## Timebox: 60 dakika

| Faz | Süre | İçerik |
|---|---|---|
| Hazırlık | 5 dk | Charter'ı oku, ortamı ve test kullanıcılarını doğrula, ilk hipotezleri yaz |
| Keşif | 45 dk | Dene, gözle, not al; hipotezleri sürekli güncelle |
| Toparlama | 10 dk | Notları sınıfla, kanıtı tamamla, özeti doldur (`templates/session-summary.md`) |

Süreyi üç kovaya ayır ve özet tablosuna dakika olarak yaz: Test, Bug inceleme, Ortam (kurulum/bekleme/erişim sorunları).

## Not etiketleri

Her not satırı: `HH:MM ETİKET metin`

| Etiket | Anlam |
|---|---|
| `DENEDIM` | Yapılan deneme ve gözlenen sonuç (bug değilse de yazılır) |
| `BUG` | Beklenen/gerçek sapma; oracle ve kanıt referansı ile |
| `SORU` | Karar verilemeyen davranış; ürün sahibine/ekibe sorulacak |
| `FIKIR` | Sonraki oturum için hipotez, charter veya iyileştirme fikri |

Örnek:
```
10:12 DENEDIM Kaydet butonuna hızlı çift tıklama, tek kayıt oluştu
10:19 BUG Offline iken gönder, geri gelince iki kayıt (kanıt: har-03.json)
10:24 SORU Silinmiş kaydın bağlantısı 404 mü 403 mü dönmeli?
10:31 FIKIR Aynı akışı mobilde arka plana atarak dene
```

## Çıkış kriteri

Oturum şu durumlardan biri olunca biter:
1. 60 dk doldu (toparlama için son 10 dk ayrılır; keşif 45. dakikada durur).
2. Charter'ın "Bulmak için" sorusu yanıtlandı (bulgu veya "bulunamadı" kanıtıyla).
3. Engelleyici sorun çıktı (ortam çöktü, erişim yok); bu durum özette "Ortam" süresine ve "Kapsanmayan"a yazılır.

Çıkışta özet zorunludur. "Kapsanmayan" ve "Sonraki görev" boş bırakılamaz.

## Sweep ile fark

| Konu | Sweep | Session |
|---|---|---|
| Checklist | Zorunlu | Zorunlu değil |
| Hipotez üretimi | Yapılandırılmış | Serbest, oturum boyunca |
| Kapsam | Modül/akış geneli | Tek charter |
| Çıktı | Tam rapor | Tek sayfa özet + notlar |
| Kanıt kuralları | Geçerli | Aynen geçerli |
| Test verisi hijyeni | Geçerli | Aynen geçerli |

### Aynen geçerli kurallar

Kanıt kuralları: her BUG için oracle, tekrar adımları ve kanıt (ekran görüntüsü, HAR, log). Bkz. `references/core/evidence-capture.md`, `references/core/oracle-hierarchy.md`.

Test verisi hijyeni:
- Mevcut veri salt okunurdur; değiştirme/silme yok.
- Çakışma (collision) denemeleri yalnız bu koşuda oluşturulan verilerle yapılır.
- IDOR/yetki denemeleri iki adet kendi test kullanıcısıyla yapılır; başkasının gerçek verisine dokunulmaz.
- Bkz. `references/core/security-hygiene.md`.

## Sonraki adım

Oturum bulguları `charters-backlog.md` içine yeni charter olarak (Kaynak: bug/soru) eklenir.

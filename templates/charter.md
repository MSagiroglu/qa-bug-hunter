# Charter Şablonu ve Örnekler

Biçim:
```
Keşfet <alan>
Şununla <kaynak / teknik>
Bulmak için <bilgi / risk>
```

## Örnek 1 (API-only)

Keşfet sipariş oluşturma uç noktasını (POST /orders)
Şununla aynı Idempotency-Key ile tekrarlanan istekler, eş zamanlı çift istek ve `page=0/-1/999999` listeleme sınırları
Bulmak için çift kayıt, yanlış durum kodu veya sayfalama taşması riskini.

## Örnek 2 (Mobil)

Keşfet formu doldururken uygulamanın arka plana alınıp geri gelmesi akışını
Şununla arka plana atma, ekran döndürme, bağlantı kaybı ve düşük pil modu
Bulmak için girilen verinin kaybolması veya çift gönderim riskini.

## Örnek 3 (Web overlay/modal)

Keşfet silme onayı modalını
Şununla Esc, geri tuşu, dışarı tıklama, Tab ile odak döngüsü ve açıkken sayfa kaydırma
Bulmak için odak tuzağı kopması, arka plan etkileşimi veya modalın yetim kalması riskini.

## Örnek 4 (Web arama)

Keşfet arama kutusunu
Şununla Türkçe `I/ı İ/i` büyük-küçük harf, özel karakter ve çok uzun girdi
Bulmak için eşleşme kaçıkları ve hata mesajı sızıntısı riskini.

## Örnek 5 (Web form + yetki)

Keşfet profil düzenleme formunu
Şununla iki kendi test kullanıcısı, bayat sekme ve eşzamanlı düzenleme
Bulmak için kayıp güncelleme ve başka kullanıcının kaydına erişim (IDOR) riskini.

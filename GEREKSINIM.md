# Gaz Kesim Defteri: bilgi işlem ve amir görüşmesi için özet

## Amaç
Arıza nedeniyle gazı kesilen adreslerin vardiyalar arasında takibi. Kesen ekip adres, neden, fotoğraf ve açıklama girer. Gazı açan ekip aynı kaydı kapatır. Böylece sonraki vardiya hangi adreste gazın kesik olduğunu görür.

## Kullanıcılar
10-15 acil ekip görevlisi ve yönetici (sicil numarasıyla giriş). Android telefon.

## Tutulan veriler
| Veri | Kişisel veri mi |
|---|---|
| Adres | Evet (abonenin adresi) |
| Abone numarası | Evet |
| İş emri numarası | Hayır |
| Arıza nedeni, açıklama | Girilen metne bağlı |
| Fotoğraf (en fazla 3 adet) | Çekime göre değişir |
| Çalışan adı, sicil numarası, işlem zamanı | Evet (çalışan verisi) |

Ad, telefon ve kimlik numarası girilmemesi kullanıcıya formda hatırlatılır.

## Şu anki teknik yapı
- Android uygulaması (Capacitor ile paketlenmiş web uygulaması).
- Ortak veri ve giriş: Google Firebase (Authentication ve Firestore). Sunucu şirket dışındadır.
- Yetki: ekip listesindeki sicil + takım kodu ile hesap açılır. Yönetici, ekip listesini yönetir.
- Fotoğraflar küçültülmüş halde Firestore'da tutulur.

## Bilgi işlemden istenecekler
1. Bu yapının kullanılıp kullanılamayacağı. Kullanılamazsa şirketin kendi sunucusunda çalışacak bir arka uç.
2. Verinin Google Firebase'de tutulmasının KVKK ve şirket politikası açısından uygunluğu, veri saklama süresi.
3. Şirketin kendi Firebase/Google hesabı altında kurulum (kişisel hesap yerine).
4. İmzalı APK dağıtımı (mobil cihaz yönetimi veya kurumsal mağaza).
5. Gerçek kullanıcı yönetimi: şifre sıfırlama, işten ayrılanın erişiminin kapatılması, kayıtların dışa aktarılması ve yedeklenmesi.
6. Kayıt silme ve erişim kayıtları için denetim ihtiyacı.

## Bilinen sınırlar (ilk sürüm)
- Şifre sıfırlama uygulama içinde yok.
- Kayıtları dosyaya aktarma yok.
- Kayıt zamanları telefonun saatinden alınır.
- Yalnızca Android.

# Gaz Kesim Defteri: kurulum rehberi

Bu proje, Android telefonlara kurulan bir uygulamadır. Ortak veri Google Firebase üzerinde tutulur. Kurulum üç bölümden oluşur: Firebase, APK derleme, ilk kullanım.

Önemli: Kod, Firebase'e bağlı olarak gerçek ortamda denenmedi. Yalnızca ekranlar sahte veriyle açılıp kontrol edildi. İlk kurulumda önce kendiniz ve bir arkadaşınızla deneyin.

## 1. Firebase hazırlığı (yaklaşık 15 dakika)

1. https://console.firebase.google.com adresinde bir Google hesabıyla "Proje ekle" deyin. Ücretsiz Spark planı yeterlidir. Google Analytics'i kapatabilirsiniz.
2. Proje ekranında "Web uygulaması ekle" (</> simgesi) deyin. Çıkan `firebaseConfig` değerlerini `www/firebase-config.js` dosyasına yapıştırın.
3. Sol menüde **Authentication > Sign-in method** bölümünden **E-posta/Şifre** yöntemini açın.
4. **Firestore Database > Veritabanı oluştur** deyin. Konum olarak Avrupa'dan birini seçin (örn. `eur3` veya `europe-west`). "Üretim modunda başlat" seçin.
5. Firestore'da **Kurallar** sekmesine `firestore.rules` dosyasının tamamını yapıştırıp **Yayınla** deyin.
6. Firestore'da **Veri** sekmesinde iki belge oluşturun:
   - Koleksiyon `ayar`, belge kimliği `kod`, alan `deger` (metin) = ekibe vereceğiniz takım kodu (uzun ve tahmin edilmesi zor olsun)
   - Koleksiyon `ayar`, belge kimliği `yoneticiKodu`, alan `deger` (metin) = yalnızca sizin ve şefinizin bileceği yönetici kodu

Bu iki kod uygulamadan okunamaz. Değiştirmek için konsoldan belgeyi düzenleyin.

## 2. APK derleme

### Yol A: GitHub ile (bilgisayara Android kurmadan)

1. GitHub'da **özel (private)** bir depo açın ve bu klasörün içeriğini yükleyin. `www/firebase-config.js` dosyasında kendi Firebase ayarlarınız olmalı.
2. Depoda **Actions > APK derle > Run workflow** deyin.
3. İş bitince sayfanın altındaki **gaz-kesim-defteri-apk** dosyasını indirin. İçindeki `app-debug.apk` telefona kurulur.

### Yol B: Kendi bilgisayarınızda

Gerekenler: Node.js 20, JDK 17, Android Studio.

```
npm install
npm run build
npx cap add android
npx cap sync android
```

Sonra `android/app/src/main/AndroidManifest.xml` dosyasında `</manifest>` satırından önce şunu ekleyin:

```
<uses-permission android:name="android.permission.CAMERA" />
```

Ardından `npx cap open android` ile Android Studio'yu açın ve **Build > Build APK(s)** deyin.

### APK'yı telefona kurma

APK dosyasını telefona gönderin ve açın. Telefon "bilinmeyen kaynak" izni isteyecektir. Bu bir test sürümü (debug) imzalı APK'dır. Şirket içi dağıtım için bilgi işlemle imzalı bir sürüm düzenlemeniz iyi olur.

## 2b. Web sürümü (telefona kısayol, kurulum gerektirmez)

Aynı uygulama bir web adresinde yayınlanır. Telefonda adresi açıp ana ekrana eklenir. Her güncelleme, internet varken uygulama açıldığında kendiliğinden gelir. Deneme dönemi için APK'dan hızlıdır.

Önce 1. bölümdeki Firebase adımlarını ve `www/firebase-config.js` dosyasını doldurmayı tamamlayın.

### Yol 1: GitHub Pages (en kolayı)

1. APK için açtığınız GitHub deposunu kullanın. Ücretsiz hesapta GitHub Pages için depo **herkese açık (Public)** olmalıdır. Depoda **Settings > General** altında en alta inip **Change visibility > Make public** deyin. Herkese açık depoda kodunuz ve `firebase-config.js` içindeki Firebase ayarları herkes tarafından görülür. Bu ayarlar gizli değildir, verileri `firestore.rules` kuralları korur. `www/ayarlar.js` içine kurum adı yazdıysanız o da görünür olur.
2. **Settings > Pages** bölümünde **Source** olarak **GitHub Actions** seçin.
3. **Actions** sekmesinde **Web sürümünü yayınla** işini çalıştırın (**Run workflow**). Yeşil tik çıkınca işin sayfasında adres görünür. Adres şuna benzer: `https://KULLANICIADI.github.io/gaz-kesim-defteri/`
4. Firebase konsolunda **Authentication > Settings > Authorized domains** bölümünde **Add domain** deyin ve `KULLANICIADI.github.io` yazın.

### Yol 2: Firebase Hosting (kod gizli kalır)

Bilgisayarda Node.js 20 gerekir. Firebase konsolunda **Build > Hosting > Get started** deyin, sonra proje klasöründe:

```
npm install
npm run build
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only hosting
```

Komut sonunda `https://PROJEADI.web.app` adresi görünür. Bu adres Firebase'de yetkili sayılır, ek ayar gerekmez.

### Telefona ekleme

- **Android (Chrome):** Adresi açın, sağ üstte üç nokta menüsünde **Uygulamayı yükle** veya **Ana ekrana ekle** deyin.
- **iPhone (Safari):** Adresi açın, **Paylaş** simgesinden **Ana Ekrana Ekle** deyin.

İlk açılışta telefon kamera izni isteyecektir. Fotoğraf çek düğmesi tarayıcıda doğrudan kamerayı açar, Galeriden seç düğmesi dosya seçiciyi açar.

### Güncelleme

Dosyaları depoya yeniden yüklediğinizde (**Add file > Upload files**) yayın kendiliğinden yenilenir. Kullanıcılar uygulamayı bir sonraki internetli açılışta yeni sürümle görür. Kurulum ya da APK dağıtımı gerekmez.

## 3. İlk kullanım

1. Uygulamayı açın, **Hesap oluştur** sekmesine geçin.
2. Sicil numaranızı ve bir şifre yazın (en az 6 karakter). **Yönetici hesabı mı açıyorsunuz?** bölümünü açıp yönetici kodunu ve ad soyadınızı yazın. Takım kodu alanına da takım kodunu yazın.
3. Girişten sonra **Ekip listesini ve sicil numaralarını düzenle** butonuna dokunun. İlk seferde **Varsayılan ekip listesini oluştur** ile 8 isim ve 2 boş satır gelir. Her satırın yanındaki **Düzenle** ile sicil numaralarını girin. 9 ve 10. satırlar boş kalır, ileride isim ve sicil yazarak doldurulur.
4. Takım kodunu arkadaşlara verin. Her arkadaş **Hesap oluştur** ile kendi sicil numarası, şifresi ve takım koduyla hesap açar. Adı, listedeki satırdan otomatik alınır.
5. Gaz kesen ve açan kişinin adı ve sicil numarası kayda otomatik yazılır.

## Sık karşılaşılan durumlar

- **Şifre unutuldu:** Uygulamada şifre sıfırlama yoktur. Firebase konsolunda Authentication bölümünden kullanıcıyı silin ve kişi aynı sicil ile yeniden hesap açsın.
- **Birinin erişimini kapatma:** Ekip listesinde satırı açıp "Hesabın ekip erişimini kaldır" deyin ve satırı boşaltın. Kişinin Firebase hesabını da konsoldan silin.
- **Kayıtları dışarı aktarma:** İlk sürümde yok. Firestore konsolundan veya sonraki bir sürümle eklenebilir.
- **Kamera açılmıyor:** Telefon ayarlarında uygulamaya kamera izni verin.

## Veri ve gizlilik

- Kayıtlarda adres, abone numarası, çalışan adı, sicil numarası ve fotoğraf bulunur. Bunlar kişisel veridir. Uygulamayı ekibe dağıtmadan önce amirinizden ve bilgi işlemden onay alın. `GEREKSINIM.md` dosyası bu görüşme için hazırlanmıştır.
- Veriler Google Firebase sunucularında durur, şirket sunucusunda değildir.
- Fotoğraflar küçültülerek Firestore'da saklanır. Ücretsiz plan sınırları dolarsa Firebase konsolunda uyarı görürsünüz.
- Giriş sicil numarası ve şifreyle yapılır. Sistem içinde sicil numarası, sahte bir e-posta adresine çevrilir (`sicil@acil.gazkesim.invalid`), gerçek e-posta toplanmaz.

## Açılış ekranı yazıları

`www/ayarlar.js` dosyasında kurum adı ve birim adını yazabilirsiniz. Boş bırakırsanız yalnızca birim adı görünür.

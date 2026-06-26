# 📍 Bursa Rota Planlayıcı & Akıllı Adres Çözümleyici

Bu proje, harita üzerinde çoklu durak rotaları oluşturmanıza, adreslerinizi kaydetmenize, koordinatla arama yapmanıza ve **Google Haritalar (goo.gl)** paylaşılan linklerini doğrudan çözerek konum olarak eklemenize olanak sağlayan profesyonel bir rota planlama uygulamasıdır.

Uygulama, Google Haritalar'ın link yönlendirme sınırlarını göz önünde bulundurarak akıllı bir biçimde tasarlanmıştır ve en güncel web teknolojilerini (React + Vite + Express + OpenStreetMap Reverse Geocoding) kullanır.

Verileriniz doğrudan VDS üzerindeki güvenli yerel dosya sistemine (`data/addresses.json`) şifrelenmiş oturum kontrolleriyle kaydedilir.

---

## ✨ Öne Çıkan Özellikler

- 🗺️ **Zengin Harita Entegrasyonu**: Leaflet & OpenStreetMap alt yapısıyla yüksek performanslı harita takibi.
- 🔗 **Google Harita Linki Çözümleme**: `https://maps.app.goo.gl/...` gibi kısa veya uzun Google Haritalar linklerini kopyalayıp arama kutusuna yapıştırdığınızda, sunucu arka planda linki çözerek gerçek koordinatları ve konum ismini anında bulur.
- 🌐 **Koordinat ile Arama**: Arama çubuğuna doğrudan `40.1826, 29.0660` gibi enlem ve boylam girerek nokta atışı yer tespiti.
- 🗂️ **Adres Defteri ve Kayıt**: Sık kullandığınız adresleri özelleştirilmiş isimlerle (Ev, İş, Müşteri vb.) kaydedin.
- ⚡ **Çoklu Rota Sihirbazı (Tik ile Seçim)**: Kayıtlı onlarca adresiniz arasından gitmek istediğiniz yerleri istediğiniz sırayla seçerek anında en verimli rotayı tek tıkla oluşturun.
- ⚠️ **Google Haritalar Durak Sınırı Kontrolü**: Google Haritalar'ın desteklediği maksimum 10 durak (Başlangıç + Varış + 8 Ara Durak) sınırını aşmamanız için akıllı uyarılar ve otomatik limit kontrolleri.
- 🔒 **Yüksek Güvenlikli Giriş**: Kaba kuvvet (brute-force) saldırı korumalı, IP engelleme yetenekli ve oturum zaman aşımlı şifreli giriş paneli.
- 🔄 **Canlı Uygulama Güncelleme**: Uygulama arayüzü üzerinden tek tıkla GitHub'daki en güncel kodları çekip otomatik derleme ve PM2 üzerinde yeniden başlatma.

---

## ⚙️ VDS (Ubuntu/Linux) Sunucu Kurulum Kılavuzu

Uygulamayı VDS sunucunuzda doğrudan istediğiniz port üzerinden çalıştırmak için aşağıdaki adımları uygulamanız yeterlidir.

### 1. Gerekli Sistem Paketlerinin Kurulumu

VDS sunucunuza SSH ile bağlandıktan sonra sisteminizi güncelleyin ve **Node.js (v18+)** ve **Git** paketlerini kurun:

```bash
# Sistem paketlerini güncelle
sudo apt update && sudo apt upgrade -y

# Node.js LTS sürümünü kur (NodeSource kullanarak)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Sürümleri doğrulayın
node -v
npm -v
```

### 2. Projenin GitHub'dan Çekilmesi

Projenizi sunucuya klonlayın ve bağımlılıkları yükleyin:

```bash
# Projenin kurulacağı dizine gidin (Örn: /var/www veya /home)
cd /var/www

# Projeyi GitHub'dan klonlayın
git clone https://github.com/szgnemin1/rota.git
cd rota

# Gerekli bağımlılıkları yükleyin
npm install
```

### 3. Port ve Şifre Ayarlarının Yapılması (.env)

Sunucuda `.env` dosyası oluşturun:

```bash
cp .env.example .env
```

Ardından `.env` dosyasını bir metin editörü (örneğin `nano`) ile açarak port, şifre ve güvenlik ayarlarını düzenleyin:
```bash
nano .env
```

`.env` dosyasının içeriği aşağıdaki gibidir:
```env
# Sunucunun çalışacağı Port (İstediğiniz portu buraya yazın)
PORT=3000

# Panele giriş şifresi (Yüksek güvenlik için güçlü bir şifre belirleyin)
APP_PASSWORD=Bursa16!

# Güvenli oturum anahtarı (Rastgele ve uzun bir metin girin)
SESSION_SECRET=bursa-rota-planlayici-guvenli-oturum-anahtari-16
```
*(Kaydedip çıkmak için: `CTRL+O`, `Enter`, `CTRL+X`)*

---

### 4. Projenin Derlenmesi (Production Build)

React istemcisini ve Express sunucusunu üretim moduna derlemek için:

```bash
npm run build
```

Bu komut bittiğinde dosyalarınız otomatik olarak derlenip `dist/` klasörüne hazır hale getirilir.

---

### 5. PM2 ile Uygulamayı Arka Planda Sürekli Çalıştırma

Uygulamanın sunucu kapansa bile seçtiğiniz portta kesintisiz çalışması ve çökme durumlarında otomatik olarak yeniden başlatılması için **PM2** kullanıyoruz:

```bash
# PM2 süreç yöneticisini kurun
sudo npm install -y -g pm2

# Uygulamayı PM2 ile başlatın
pm2 start dist/server.cjs --name "rotaplan"

# VDS yeniden başlasa bile uygulamanın otomatik açılması için:
pm2 startup
# (Yukarıdaki komutun çıktı olarak verdiği kalın yazılı komutu kopyalayıp konsola yapıştırıp çalıştırın)

# PM2 durumunu kaydedin
pm2 save
```

Uygulamanız artık tamamen hazır! Tarayıcınızdan doğrudan **`http://VDS_IP_ADRESINIZ:PORT`** (Örn: `http://195.123.45.67:3000`) yazarak panelinize şifrenizle güvenle erişebilirsiniz.

---

## 🔄 Otomatik Güncelleme Kurulumu (Canlı Panel & update.sh)

Arayüzdeki **Güncelleme (Yenile) Butonu** doğrudan VDS üzerindeki `update.sh` dosyasını tetikler. Bu betik GitHub'dan en güncel kodlarınızı çeker, derler ve PM2 servisini otomatik olarak yeniden başlatır.

### Güncelleme Betiğini Yetkilendirme:
Otomatik güncellemenin sorunsuz çalışabilmesi için VDS sunucusunda `update.sh` dosyasına çalıştırma yetkisi verin:

```bash
cd /var/www/rota
chmod +x update.sh
```

### Zamanlanmış Otomatik Güncelleme (Gece 04:00'te Kendi Kendine Güncelleme):
Eğer güncelleme butonuna basmakla uğraşmak istemiyorsanız ve VDS'in her gece saat 04:00'te kodları GitHub'dan çekip otomatik güncellemesini istiyorsanız sistem crontab'ına ekleyebilirsiniz:

```bash
crontab -e
```

Açılan dosyanın en altına şu satırı ekleyin:
```cron
0 4 * * * /var/www/rota/update.sh >> /var/www/rota/update.log 2>&1
```

---

## 🛠️ Yerel Geliştirme (Local Development)

Projeyi kendi bilgisayarınızda geliştirmek istiyorsanız:

```bash
npm install
npm run dev
```

Uygulama `http://localhost:3000` portunda çalışacaktır.

---

## 📝 Lisans

Bu proje açık kaynaklı olup, kişisel veya kurumsal kullanıma tamamen uygundur.
Başarılar dileriz! 🚀

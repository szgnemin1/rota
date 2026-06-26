# 📍 Bursa Rota Planlayıcı & Akıllı Adres Çözümleyici

Bu proje, harita üzerinde çoklu durak rotaları oluşturmanıza, adreslerinizi kaydetmenize, koordinatla arama yapmanıza ve **Google Haritalar (goo.gl)** paylaşılan linklerini doğrudan çözerek konum olarak eklemenize olanak sağlayan profesyonel bir rota planlama uygulamasıdır.

Uygulama, Google Haritalar'ın link yönlendirme sınırlarını göz önünde bulundurarak akıllı bir biçimde tasarlanmıştır ve en güncel web teknolojilerini (React + Vite + Express + OpenStreetMap Reverse Geocoding) kullanır.

---

## ✨ Öne Çıkan Özellikler

- 🗺️ **Zengin Harita Entegrasyonu**: Leaflet & OpenStreetMap alt yapısıyla yüksek performanslı harita takibi.
- 🔗 **Google Harita Linki Çözümleme**: `https://maps.app.goo.gl/...` gibi kısa veya uzun Google Haritalar linklerini kopyalayıp arama kutusuna yapıştırdığınızda, sunucu arka planda linki çözerek gerçek koordinatları ve konum ismini anında bulur.
- 🌐 **Koordinat ile Arama**: Arama çubuğuna doğrudan `40.1826, 29.0660` gibi enlem ve boylam girerek nokta atışı yer tespiti.
- 🗂️ **Adres Defteri ve Kayıt**: Sık kullandığınız adresleri özelleştirilmiş isimlerle (Ev, İş, Müşteri vb.) kaydedin.
- ⚡ **Çoklu Rota Sihirbazı (Tik ile Seçim)**: Kayıtlı onlarca adresiniz arasından gitmek istediğiniz yerleri istediğiniz sırayla seçerek anında en verimli rotayı tek tıkla oluşturun.
- ⚠️ **Google Haritalar Durak Sınırı Kontrolü**: Google Haritalar'ın desteklediği maksimum 10 durak (Başlangıç + Varış + 8 Ara Durak) sınırını aşmamanız için akıllı uyarılar ve otomatik limit kontrolleri.
- 🖥️ **Tam Duyarlı Mobil Tasarım**: Hem masaüstünde hem de mobil cihazlarda kusursuz kullanım deneyimi.

---

## ⚙️ VDS (Ubuntu/Linux) Sunucu Kurulum Kılavuzu

Uygulamayı kendi VDS sunucunuzda yayına almak ve kesintisiz çalışmasını sağlamak için aşağıdaki adımları sırasıyla uygulayabilirsiniz.

### 1. Gerekli Sistem Paketlerinin Kurulumu

VDS sunucunuza SSH ile bağlandıktan sonra sisteminizi güncelleyin ve **Node.js (v18+)**, **Nginx** ve **Git** paketlerini kurun:

```bash
# Sistem paketlerini güncelle
sudo apt update && sudo apt upgrade -y

# Node.js LTS sürümünü kur (NodeSource kullanarak)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx ve Git kur
sudo apt install -y nginx git

# Node.js ve npm sürümlerini doğrulayın
node -v
npm -v
```

### 2. Projenin GitHub'dan Çekilmesi ve Hazırlanması

Projenizi sunucuya klonlayın ve bağımlılıkları yükleyin:

```bash
# Projenin kurulacağı dizine gidin (genellikle /var/www)
cd /var/www

# Projeyi GitHub'dan klonlayın
git clone https://github.com/szgnemin1/rota.git
cd rota

# Gerekli bağımlılıkları yükleyin
npm install
```

### 3. Ortam Değişkenlerinin Ayarlanması

Sunucuda `.env` dosyası oluşturun:

```bash
cp .env.example .env
```

Ardından `.env` dosyasını bir metin editörü (örneğin `nano`) ile açarak gerekli düzenlemeleri yapın:
```bash
nano .env
```
*(Dosyayı kaydedip çıkmak için: `CTRL+O`, `Enter`, `CTRL+X`)*

---

### 4. Üretim (Production) Derlemesinin Alınması

Projenin istemci (React) ve sunucu (Express) kodlarını tek bir optimize edilmiş pakete dönüştürmek için derleme komutunu çalıştırın:

```bash
npm run build
```

Bu komut başarılı bir şekilde tamamlandığında istemci dosyalarını `dist/` klasörüne, çalıştırılabilir Node.js sunucusunu ise `dist/server.cjs` dosyasına derleyecektir.

---

### 5. PM2 ile Uygulamayı Arka Planda Sürekli Çalıştırma

Uygulamanın sunucu kapansa bile arka planda kesintisiz çalışması ve çökme durumlarında otomatik olarak yeniden başlatılması için **PM2** süreç yöneticisini kullanıyoruz:

```bash
# PM2 global olarak kurun
sudo npm install -y -g pm2

# Uygulamayı PM2 ile başlatın
pm2 start dist/server.cjs --name "rotaplan"

# Sunucu yeniden başladığında uygulamanın otomatik açılması için başlangıç betiğini yapılandırın
pm2 startup
# (Yukarıdaki komut size çalıştırmanız için kalın yazılı bir komut verecektir, o komutu kopyalayıp yapıştırarak çalıştırın)

# PM2 durumunu kaydedin
pm2 save
```

---

### 6. Nginx ve SSL (HTTPS) Yapılandırması

Nginx kullanarak gelen web isteklerini PM2 üzerinde `3000` portunda çalışan uygulamamıza yönlendireceğiz.

Yeni bir Nginx yapılandırma dosyası oluşturun:
```bash
sudo nano /etc/nginx/sites-available/rotaplan
```

Aşağıdaki yapılandırmayı yapıştırın (alan adınızı `alanadiniz.com` ile değiştirin):

```nginx
server {
    listen 80;
    server_name alanadiniz.com www.alanadiniz.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Google Link çözümlemesi gibi uzun süren reverse-lookup işlemleri için zaman aşımlarını artırın
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

Yapılandırmayı etkinleştirin ve Nginx servisini yeniden başlatın:
```bash
# Sembiyotik link oluşturarak yapılandırmayı aktif edin
sudo ln -s /etc/nginx/sites-available/rotaplan /etc/nginx/sites-enabled/

# Nginx sözdizimi doğruluğunu kontrol edin
sudo nginx -t

# Nginx'i yeniden yükleyin
sudo systemctl restart nginx
```

#### Ücretsiz SSL (Certbot / Let's Encrypt) Kurulumu:
Sitenizin güvenli (https://) bağlantıya sahip olması için aşağıdaki adımlarla ücretsiz SSL sertifikası kurun:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d alanadiniz.com -d www.alanadiniz.com
```
*Gelen yönergeleri takip ederek e-posta adresinizi girin ve yönlendirmeleri onaylayın. Certbot, Nginx dosyanızı otomatik olarak HTTPS'e güncelleyecektir.*

---

## 🔄 VDS Otomatik Güncelleme (CI/CD) Kurulumu

GitHub'da kodlarınızı güncellediğinizde VDS sunucunuzun otomatik olarak güncellenmesi için iki farklı yöntem kullanabilirsiniz:

### Yöntem A: Manuel veya Zamanlanmış Tek Tıkla Güncelleme (`update.sh`)

Sizin için hazırladığımız `update.sh` betiği, tek satır komutla en son güncellemeleri çekip derler ve sunucuyu sıfır kesintiyle yeniden başlatır.

1. Dosyaya çalıştırma yetkisi verin:
   ```bash
   chmod +x update.sh
   ```
2. Güncelleme yapmak istediğinizde sadece şu komutu çalıştırmanız yeterlidir:
   ```bash
   ./update.sh
   ```

#### Otomatik Güncelleme Zamanlama (Cronjob):
Eğer sunucunun her gece saat 04:00'te GitHub'dan değişiklikleri kontrol edip otomatik güncellenmesini istiyorsanız sisteme cronjob tanımlayabilirsiniz:

```bash
# Cron tablosunu düzenle
crontab -e
```

Dosyanın en altına şu satırı ekleyin:
```cron
0 4 * * * /var/www/rota/update.sh >> /var/www/rota/update.log 2>&1
```

---

### Yöntem B: GitHub Webhook ile Tam Otomatik Güncelleme

Siz her `git push` yaptığınızda sunucunuzun anında güncellenmesini isterseniz, sunucuda basit bir webhook dinleyici kurabilirsiniz.

1. **`webhook` paketini sunucuya kurun:**
   ```bash
   sudo apt install webhook
   ```
2. **Webhook yapılandırmasını oluşturun:**
   ```bash
   sudo nano /etc/webhook.conf
   ```
   Aşağıdaki JSON şablonunu girin:
   ```json
   [
     {
       "id": "github-update",
       "execute-command": "/var/www/rota/update.sh",
       "command-working-directory": "/var/www/rota",
       "response-message": "Güncelleme başlatıldı..."
     }
   ]
   ```
3. **Webhook servisini arka planda başlatın:**
   ```bash
   sudo systemctl enable webhook
   sudo systemctl start webhook
   ```
4. **GitHub Webhook Ayarı:**
   GitHub deponuzda (szgnemin1/rota) -> **Settings** -> **Webhooks** -> **Add Webhook** yolunu izleyin:
   - **Payload URL:** `http://alanadiniz.com:9000/hooks/github-update` *(veya IP adresinizle port `9000`'i harici erişime açarak)*
   - **Content type:** `application/json`
   - **Just the push event** seçip webhook'u kaydedin.

Artık GitHub'a yeni kod gönderdiğiniz an sunucunuz sıfır kesintiyle kendini güncelleyecektir!

---

## 🛠️ Yerel Geliştirme (Local Development)

Projeyi kendi bilgisayarınızda yerel olarak çalıştırmak istiyorsanız:

```bash
# Depoyu klonlayın ve dizine girin
git clone https://github.com/szgnemin1/rota.git
cd rota

# Paketleri kurun
npm install

# Geliştirme (Development) sunucusunu başlatın
npm run dev
```

Uygulama tarayıcınızda `http://localhost:3000` adresinde çalışacaktır.

---

## 📝 Lisans

Bu proje açık kaynaklı olup, kişisel veya kurumsal kullanıma tamamen uygundur.
Başarılar dileriz! 🚀

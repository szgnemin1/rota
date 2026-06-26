#!/bin/bash

# ==============================================================================
# Rota Planlayıcı - VDS Otomatik Güncelleme Betiği (szgnemin1/rota)
# ==============================================================================

# Hatalarda çalışmayı durdur
set -e

echo "🔄 Rota Planlayıcı güncelleme işlemi başlatılıyor..."

# Projenin bulunduğu ana dizine geç
cd "$(dirname "$0")"

# 1. Yerel değişiklikleri sıfırla (VDS'teki çakışmaları önlemek için)
echo "📦 En güncel kodlar GitHub'dan çekiliyor..."
git fetch origin main
git reset --hard origin/main

# 2. Bağımlılıkları temiz ve güvenli bir şekilde kur
echo "🛠️ Bağımlılıklar güncelleniyor..."
npm install

# 3. Production derlemesini oluştur (Vite + Esbuild server bundle)
echo "🚀 Proje derleniyor (Production Build)..."
if ! npm run build; then
    echo "⚠️ Derleme sırasında bir hata oluştu! Muhtemelen Tailwind Oxide veya işletim sistemi mimarisi uyumsuzluğundan kaynaklanan bir yerel kütüphane hatası."
    echo "🧹 'node_modules' ve 'package-lock.json' temizleniyor, temiz kurulum başlatılıyor..."
    rm -rf node_modules package-lock.json
    
    echo "📥 Temiz bağımlılık kurulumu başlatılıyor (npm install --force)..."
    npm install --force
    
    echo "🚀 Proje tekrar derleniyor..."
    npm run build
fi

# 4. PM2 süreci varsa yeniden başlat, yoksa yeni bir tane başlat
echo "🔄 PM2 süreci güncelleniyor..."
if pm2 describe rotaplan > /dev/null 2>&1; then
    echo "PM2 'rotaplan' servisi yeniden başlatılıyor..."
    pm2 restart rotaplan
else
    echo "PM2 'rotaplan' servisi ilk kez başlatılıyor..."
    pm2 start dist/server.cjs --name "rotaplan"
fi

echo "✅ Güncelleme başarıyla tamamlandı ve servis aktif!"

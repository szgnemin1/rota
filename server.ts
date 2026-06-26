import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  app.use(express.json());
  // --- CONFIGURATION ---
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const APP_PASSWORD = process.env.APP_PASSWORD || "Bursa16!";
  const SESSION_SECRET = process.env.SESSION_SECRET || "bursa-rota-planlayici-guvenli-oturum-anahtari-16";
  const DATA_DIR = path.join(process.cwd(), "data");
  const ADDRESS_FILE = path.join(DATA_DIR, "addresses.json");

  // Ensure data directory and addresses file exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ADDRESS_FILE)) {
    fs.writeFileSync(ADDRESS_FILE, JSON.stringify([], null, 2), "utf-8");
  }

  // --- SECURITY: SESSION STORAGE & RATE LIMITING ---
  // In-memory active sessions: token -> expiresAt
  const activeSessions = new Map<string, number>();

  // Brute-force protection map: ip -> { failedCount, blockUntil }
  const bruteForceMap = new Map<string, { failedCount: number; blockUntil: number }>();

  // Helper to hash password or token for comparison
  function hashString(str: string): string {
    return crypto.createHmac("sha256", SESSION_SECRET).update(str).digest("hex");
  }

  // Rate limiter middleware for login attempts
  const loginRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
    const record = bruteForceMap.get(ip);
    const now = Date.now();

    if (record && record.blockUntil > now) {
      const waitMinutes = Math.ceil((record.blockUntil - now) / 60000);
      res.status(429).json({
        error: `Çok fazla hatalı deneme yaptınız. Lütfen ${waitMinutes} dakika sonra tekrar deneyin.`
      });
      return;
    }

    next();
  };

  // Auth Middleware for API Protection
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers["x-app-token"] as string;

    if (!token) {
      res.status(401).json({ error: "Giriş yapılması gerekiyor." });
      return;
    }

    const expiry = activeSessions.get(token);
    if (!expiry || expiry < Date.now()) {
      // Clean up expired session
      activeSessions.delete(token);
      res.status(401).json({ error: "Oturum süreniz doldu. Lütfen tekrar giriş yapın." });
      return;
    }

    // Refresh session expiry on active request (sliding expiration, 12 hours)
    activeSessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    next();
  };


  // --- SECURITY & AUTH ENDPOINTS ---

  // Check current session validity
  app.get("/api/auth/check", (req, res) => {
    const token = req.headers["x-app-token"] as string;
    if (token && activeSessions.has(token)) {
      const expiry = activeSessions.get(token);
      if (expiry && expiry > Date.now()) {
        res.json({ valid: true });
        return;
      }
    }
    res.json({ valid: false });
  });

  // Login Endpoint with rate limit and secure token generation
  app.post("/api/auth/login", loginRateLimiter, (req, res) => {
    const { password } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

    if (!password) {
      res.status(400).json({ error: "Şifre alanı boş bırakılamaz." });
      return;
    }

    if (password === APP_PASSWORD) {
      // Success! Clear any brute force record
      bruteForceMap.delete(ip);

      // Generate secure session token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const sessionToken = hashString(rawToken);

      // Store session for 12 hours
      const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
      activeSessions.set(sessionToken, expiresAt);

      res.json({ success: true, token: sessionToken });
    } else {
      // Failed attempt
      const record = bruteForceMap.get(ip) || { failedCount: 0, blockUntil: 0 };
      record.failedCount += 1;

      if (record.failedCount >= 5) {
        // Block for 15 minutes
        record.blockUntil = Date.now() + 15 * 60 * 1000;
        bruteForceMap.set(ip, record);
        res.status(429).json({
          error: "Çok fazla hatalı deneme! Girişiniz 15 dakika boyunca bloke edilmiştir."
        });
      } else {
        bruteForceMap.set(ip, record);
        const remaining = 5 - record.failedCount;
        res.status(401).json({
          error: `Hatalı şifre! Kalan deneme hakkınız: ${remaining}`
        });
      }
    }
  });

  // Logout Endpoint
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers["x-app-token"] as string;
    if (token) {
      activeSessions.delete(token);
    }
    res.json({ success: true });
  });


  // --- ADDRESS PERSISTENCE ENDPOINTS (VDS File-based storage) ---

  // Get all saved addresses
  app.get("/api/addresses", authenticateToken, (req, res) => {
    try {
      const data = fs.readFileSync(ADDRESS_FILE, "utf-8");
      const addresses = JSON.parse(data);
      res.json(addresses);
    } catch (err: any) {
      console.error("Read addresses file failed:", err);
      res.status(500).json({ error: "Adresler okunamadı." });
    }
  });

  // Save a new address
  app.post("/api/addresses", authenticateToken, (req, res) => {
    try {
      const newAddress = req.body;
      if (!newAddress || !newAddress.id || !newAddress.label || !newAddress.lat || !newAddress.lng) {
        res.status(400).json({ error: "Geçersiz adres verisi." });
        return;
      }

      const data = fs.readFileSync(ADDRESS_FILE, "utf-8");
      const addresses = JSON.parse(data);

      // Check if already exists (prevent duplicates)
      const existsIndex = addresses.findIndex((a: any) => a.id === newAddress.id);
      if (existsIndex > -1) {
        addresses[existsIndex] = newAddress;
      } else {
        addresses.unshift(newAddress); // Add to beginning of array
      }

      fs.writeFileSync(ADDRESS_FILE, JSON.stringify(addresses, null, 2), "utf-8");
      res.json({ success: true, addresses });
    } catch (err: any) {
      console.error("Save address failed:", err);
      res.status(500).json({ error: "Adres kaydedilemedi." });
    }
  });

  // Save multiple addresses at once (Bulk save)
  app.post("/api/addresses/bulk", authenticateToken, (req, res) => {
    try {
      const newAddresses = req.body;
      if (!Array.isArray(newAddresses)) {
        res.status(400).json({ error: "Geçersiz toplu veri formatı." });
        return;
      }

      const validAddresses = newAddresses.filter(
        (a: any) => a && a.id && a.label && typeof a.lat === "number" && typeof a.lng === "number"
      );

      if (validAddresses.length === 0) {
        res.status(400).json({ error: "Kaydedilecek geçerli adres bulunamadı." });
        return;
      }

      const data = fs.readFileSync(ADDRESS_FILE, "utf-8");
      const addresses = JSON.parse(data);

      for (const newAddr of validAddresses) {
        // Prevent duplicates based on ID or very close coordinates + label
        const existsIndex = addresses.findIndex(
          (a: any) => a.id === newAddr.id || (a.label === newAddr.label && Math.abs(a.lat - newAddr.lat) < 0.0001 && Math.abs(a.lng - newAddr.lng) < 0.0001)
        );
        if (existsIndex > -1) {
          addresses[existsIndex] = { ...addresses[existsIndex], ...newAddr };
        } else {
          addresses.unshift(newAddr);
        }
      }

      fs.writeFileSync(ADDRESS_FILE, JSON.stringify(addresses, null, 2), "utf-8");
      res.json({ success: true, addresses });
    } catch (err: any) {
      console.error("Bulk save addresses failed:", err);
      res.status(500).json({ error: "Toplu adres kaydı başarısız oldu." });
    }
  });

  // Delete an address
  app.delete("/api/addresses/:id", authenticateToken, (req, res) => {
    try {
      const idToDelete = req.params.id;
      const data = fs.readFileSync(ADDRESS_FILE, "utf-8");
      const addresses = JSON.parse(data);

      const filtered = addresses.filter((a: any) => a.id !== idToDelete);

      fs.writeFileSync(ADDRESS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      res.json({ success: true, addresses: filtered });
    } catch (err: any) {
      console.error("Delete address failed:", err);
      res.status(500).json({ error: "Adres silinemedi." });
    }
  });

  // Edit an address
  app.put("/api/addresses/:id", authenticateToken, (req, res) => {
    try {
      const idToUpdate = req.params.id;
      const { label, address, lat, lng } = req.body;

      if (!label || !address || typeof lat !== "number" || typeof lng !== "number") {
        res.status(400).json({ error: "Eksik veya geçersiz adres bilgileri." });
        return;
      }

      const data = fs.readFileSync(ADDRESS_FILE, "utf-8");
      const addresses = JSON.parse(data);

      const index = addresses.findIndex((a: any) => a.id === idToUpdate);
      if (index === -1) {
        res.status(404).json({ error: "Düzenlenecek adres bulunamadı." });
        return;
      }

      addresses[index] = {
        ...addresses[index],
        label,
        address,
        lat,
        lng
      };

      fs.writeFileSync(ADDRESS_FILE, JSON.stringify(addresses, null, 2), "utf-8");
      res.json({ success: true, addresses });
    } catch (err: any) {
      console.error("Update address failed:", err);
      res.status(500).json({ error: "Adres güncellenemedi." });
    }
  });


  // --- REMOVED UPDATE TRIGGER FROM APP ---
  app.post("/api/update-app", authenticateToken, (req, res) => {
    const updateScript = path.join(process.cwd(), "update.sh");

    if (!fs.existsSync(updateScript)) {
      res.status(404).json({ error: "Güncelleme betiği (update.sh) sunucuda bulunamadı." });
      return;
    }

    console.log("Starting remote application update execution...");
    
    // Execute update script asynchronously
    exec(`bash "${updateScript}"`, (error, stdout, stderr) => {
      if (error) {
        console.error("Update execution failed:", error);
        res.status(500).json({
          success: false,
          error: "Güncelleme işlemi hata ile sonuçlandı.",
          log: stdout + "\n" + stderr + "\n" + error.message
        });
        return;
      }

      console.log("Update executed successfully!");
      res.json({
        success: true,
        message: "Güncelleme başarıyla tetiklendi ve tamamlandı!",
        log: stdout + (stderr ? "\n\nHatalar/Uyarılar:\n" + stderr : "")
      });
    });
  });


  // --- AKILLI HARİTA ÇÖZÜMLEME APISI (Protected) ---

  app.get("/api/resolve-maps-url", authenticateToken, async (req, res) => {
    const mapUrlStr = req.query.url as string;
    if (!mapUrlStr) {
      res.status(400).json({ error: "URL parametresi eksik." });
      return;
    }

    try {
      console.log("Resolving URL:", mapUrlStr);
      const response = await fetch(mapUrlStr, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });

      const finalUrl = response.url;
      console.log("Final redirected URL:", finalUrl);

      let lat = 0;
      let lng = 0;
      let found = false;

      const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lng = parseFloat(atMatch[2]);
        found = true;
      } else {
        const qMatch = finalUrl.match(/[?&](q|query|ll)=(-?\d+\.\d+)(,%2C|%2C|,)(-?\d+\.\d+)/i);
        if (qMatch) {
          lat = parseFloat(qMatch[2]);
          lng = parseFloat(qMatch[4]);
          found = true;
        } else {
          const searchMatch = finalUrl.match(/\/search\/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
          if (searchMatch) {
            lat = parseFloat(searchMatch[1]);
            lng = parseFloat(searchMatch[2]);
            found = true;
          }
        }
      }

      const html = await response.text();

      let title = "";
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1]
          .replace("- Google Maps", "")
          .replace("- Google Haritalar", "")
          .trim();
      }

      if (!found) {
        const staticMapMatch = html.match(/staticmap\?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) ||
                               html.match(/staticmap\?center=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (staticMapMatch) {
          lat = parseFloat(staticMapMatch[1]);
          lng = parseFloat(staticMapMatch[2]);
          found = true;
        } else {
          const ogUrlMatch = html.match(/meta property="og:url" content="[^"]*@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (ogUrlMatch) {
            lat = parseFloat(ogUrlMatch[1]);
            lng = parseFloat(ogUrlMatch[2]);
            found = true;
          } else {
            const stateCoordsMatch = html.match(/window\.APP_INITIALIZATION_STATE\s*=\s*\[\[\[(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                     html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (stateCoordsMatch) {
              lat = parseFloat(stateCoordsMatch[1]);
              lng = parseFloat(stateCoordsMatch[2]);
              found = true;
            }
          }
        }
      }

      if (found && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        let resolvedAddress = title || "Haritadan Çözümlenen Konum";
        try {
          const rUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=tr`;
          const rRes = await fetch(rUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 RotaPlan/1.0"
            }
          });
          if (rRes.ok) {
            const rData = await rRes.json();
            if (rData && rData.display_name) {
              resolvedAddress = rData.display_name;
            }
          }
        } catch (geoErr) {
          console.warn("Reverse geocoding after URL resolution failed:", geoErr);
        }

        res.json({
          success: true,
          label: title || "Google Harita Konumu",
          address: resolvedAddress,
          lat,
          lng
        });
      } else {
        if (title && title.length > 2) {
          console.log("No coordinates found in link, search-fetching via Nominatim:", title);
          const sUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(title + ", bursa")}&limit=1&accept-language=tr`;
          const sRes = await fetch(sUrl, {
            headers: { "User-Agent": "RotaPlan/1.0" }
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData && sData.length > 0) {
              const item = sData[0];
              res.json({
                success: true,
                label: title,
                address: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
              });
              return;
            }
          }
        }

        res.status(404).json({
          error: "Google Harita linkindeki konum koordinatları çözümlenemedi. Lütfen doğrudan arama kutusuna yazmayı veya koordinatları girmeyi deneyin."
        });
      }
    } catch (err: any) {
      console.error("Resolve short URL failed:", err);
      res.status(500).json({ error: "Sunucu hatası: " + err.message });
    }
  });


  // --- CLIENT SERVING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

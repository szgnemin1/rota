import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to resolve short Google Maps URLs to real coordinates and location names
  app.get("/api/resolve-maps-url", async (req, res) => {
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

      // 1. Try parsing from redirected URL path or query params
      // Match patterns:
      // - @40.1826042,29.0660235
      // - ?q=40.1826,29.0660
      // - &ll=40.1826,29.0660
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

      // Read HTML content to find titles or secondary metadata coordinates
      const html = await response.text();

      // Extract title/place name
      let title = "";
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1]
          .replace("- Google Maps", "")
          .replace("- Google Haritalar", "")
          .trim();
      }

      // 2. If coords not found in URL yet, search inside HTML metadata
      if (!found) {
        // Look for static map coordinates in HTML
        const staticMapMatch = html.match(/staticmap\?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) ||
                               html.match(/staticmap\?center=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (staticMapMatch) {
          lat = parseFloat(staticMapMatch[1]);
          lng = parseFloat(staticMapMatch[2]);
          found = true;
        } else {
          // Look for og:url coordinates
          const ogUrlMatch = html.match(/meta property="og:url" content="[^"]*@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (ogUrlMatch) {
            lat = parseFloat(ogUrlMatch[1]);
            lng = parseFloat(ogUrlMatch[2]);
            found = true;
          } else {
            // APP_INITIALIZATION_STATE array coordinates extraction
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
        // Let's do a quick reverse geocode to get a pretty Turkish address
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
        // Fallback: If we couldn't parse coordinates directly, let's use Nominatim search with the place name!
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

  // Serve static client assets / build output in production
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

const express = require("express");
const path = require("path");
const { Readable } = require("stream");

const app = express();
const PORT = process.env.PORT || 10000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ---------- Analyze / Fetch media info ----------

app.post("/api/fetch", async (req, res) => {
  const url = req.body && req.body.url;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "Valid URL required" });
  }

  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ success: false, error: "Server is missing API key configuration" });
  }

  try {
    const apiRes = await fetch("https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "social-download-all-in-one.p.rapidapi.com",
        "x-rapidapi-key": RAPIDAPI_KEY
      },
      body: JSON.stringify({ url })
    });

    const data = await apiRes.json();

    if (data.error || !data.medias || data.medias.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Could not fetch this link. It may be private, deleted, or unsupported."
      });
    }

    res.json({
      success: true,
      title: data.title || data.description || "Media",
      thumbnail: data.thumbnail || data.cover || data.picture || null,
      medias: data.medias.map((m) => ({
        url: m.url,
        type: m.type,
        quality: m.quality || m.type,
        extension: m.extension || (m.type === "video" ? "mp4" : m.type === "audio" ? "mp3" : "jpg")
      }))
    });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch this content. Try again." });
  }
});

// ---------- Direct download proxy (forces real download, no new tab) ----------

app.get("/api/download-proxy", async (req, res) => {
  const url = req.query.url;
  const filename = req.query.filename || "downly-file";

  if (!url || !isValidUrl(url)) {
    return res.status(400).send("Invalid URL");
  }

  try {
    const response = await fetch(url);

    if (!response.ok || !response.body) {
      return res.status(400).send("Could not fetch media");
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    Readable.fromWeb(response.body).pipe(res);

  } catch (err) {
    console.error("Proxy download error:", err);
    res.status(500).send("Failed to download");
  }
});

// ---------- Fallback ----------

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ success: false, error: "Something went wrong on the server" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Downly is running on port ${PORT}`);
});

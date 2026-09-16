const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "YouTube";
    }

    if (host.includes("tiktok.com")) {
      return "TikTok";
    }

    if (host.includes("instagram.com")) {
      return "Instagram";
    }

    if (host.includes("pinterest.com") || host === "pin.it") {
      return "Pinterest";
    }

    return null;
  } catch {
    return null;
  }
}

app.post("/api/analyze", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: "Please enter a URL."
    });
  }

  const platform = detectPlatform(url);

  if (!platform) {
    return res.status(400).json({
      success: false,
      message: "Unsupported or invalid URL."
    });
  }

  res.json({
    success: true,
    platform: platform,
    url: url
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Downly"
  });
});

app.listen(PORT, () => {
  console.log(`Downly is running on port ${PORT}`);
});

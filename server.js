const express = require("express")
const path = require("path")
const ytdl = require("@distube/ytdl-core")

const app = express()
const PORT = process.env.PORT || 10000

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// ---------- Helpers ----------

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()

    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube"
    if (host.includes("tiktok.com")) return "TikTok"
    if (host.includes("instagram.com")) return "Instagram"
    if (host.includes("pinterest.com") || host.includes("pin.it")) return "Pinterest"
    if (host.includes("facebook.com") || host.includes("fb.watch")) return "Facebook"

    return "Unknown"
  } catch {
    return "Unknown"
  }
}

function getYouTubeId(url) {
  try {
    const u = new URL(url)

    if (u.hostname.includes("youtu.be")) return u.pathname.substring(1)
    if (u.searchParams.get("v")) return u.searchParams.get("v")

    const match = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/)
    return match ? match[2] : null
  } catch {
    return null
  }
}

function isValidUrl(url) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// ---------- Analyze route ----------

app.get("/api/analyze", async (req, res) => {
  const url = req.query.url

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "A valid video URL is required" })
  }

  const platform = detectPlatform(url)

  const result = {
    success: true,
    platform,
    originalUrl: url,
    preview: null,
    downloadSupported: false
  }

  switch (platform) {
    case "YouTube": {
      const id = getYouTubeId(url)
      if (id) {
        result.preview = { type: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` }
        result.downloadSupported = true
      } else {
        result.success = false
        result.error = "Could not read this YouTube link"
      }
      break
    }

    case "TikTok":
      result.preview = { type: "tiktok", embedUrl: null }
      result.downloadSupported = true
      break

    case "Instagram":
      result.preview = { type: "instagram", embedUrl: url }
      result.downloadSupported = false
      break

    case "Facebook":
      result.preview = { type: "facebook", embedUrl: url }
      result.downloadSupported = false
      break

    case "Pinterest":
      result.preview = { type: "pinterest", embedUrl: url }
      result.downloadSupported = false
      break

    default:
      result.success = false
      result.error = "This platform is not supported"
  }

  res.json(result)
})

// ---------- Download route ----------

app.get("/api/download", async (req, res) => {
  const url = req.query.url

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "Valid URL required" })
  }

  const platform = detectPlatform(url)

  try {

    if (platform === "TikTok") {
      const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`)
      const data = await apiRes.json()

      if (data.code !== 0 || !data.data) {
        return res.status(400).json({ success: false, error: "Could not fetch this TikTok video" })
      }

      return res.json({
        success: true,
        downloadUrl: data.data.hdplay || data.data.play,
        title: data.data.title || "TikTok Video"
      })
    }

    if (platform === "YouTube") {
      const id = getYouTubeId(url)

      if (!id || !ytdl.validateID(id)) {
        return res.status(400).json({ success: false, error: "Invalid YouTube video" })
      }

      const info = await ytdl.getInfo(id)
      const format = ytdl.chooseFormat(info.formats, { quality: "highest", filter: "audioandvideo" })

      if (!format) {
        return res.status(400).json({ success: false, error: "No downloadable format found" })
      }

      return res.json({
        success: true,
        downloadUrl: format.url,
        title: info.videoDetails.title || "YouTube Video"
      })
    }

    return res.status(400).json({
      success: false,
      error: "Direct download is not supported for this platform yet"
    })

  } catch (err) {
    console.error("Download error:", err)
    return res.status(500).json({ success: false, error: "Failed to fetch video. Try again." })
  }
})

// ---------- Fallback ----------

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// ---------- Error handler ----------

app.use((err, req, res, next) => {
  console.error("Server error:", err)
  res.status(500).json({ success: false, error: "Something went wrong on the server" })
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Downly is running on port ${PORT}`)
})

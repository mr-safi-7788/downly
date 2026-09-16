const express = require("express")
const path = require("path")

const app = express()
const PORT = process.env.PORT || 10000

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

function isValidUrl(url) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// ---------- TikTok ----------

app.get("/api/tiktok", async (req, res) => {
  const url = req.query.url

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "Valid TikTok URL required" })
  }

  try {
    const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`)
    const data = await apiRes.json()

    if (data.code !== 0 || !data.data) {
      return res.status(400).json({ success: false, error: "Could not fetch this TikTok video" })
    }

    res.json({
      success: true,
      title: data.data.title || "TikTok Video",
      cover: data.data.cover,
      noWatermarkUrl: data.data.hdplay || data.data.play,
      watermarkUrl: data.data.wmplay || data.data.play,
      audioUrl: data.data.music
    })

  } catch (err) {
    console.error("TikTok error:", err)
    res.status(500).json({ success: false, error: "Failed to fetch TikTok video" })
  }
})

// ---------- Pinterest ----------

app.get("/api/pinterest", async (req, res) => {
  const url = req.query.url

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "Valid Pinterest URL required" })
  }

  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    })
    const html = await pageRes.text()

    const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/)
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)

    if (!videoMatch && !imageMatch) {
      return res.status(400).json({ success: false, error: "Could not find media on this pin" })
    }

    res.json({
      success: true,
      title: titleMatch ? titleMatch[1] : "Pinterest Pin",
      type: videoMatch ? "video" : "image",
      mediaUrl: videoMatch ? videoMatch[1] : imageMatch[1]
    })

  } catch (err) {
    console.error("Pinterest error:", err)
    res.status(500).json({ success: false, error: "Failed to fetch Pinterest pin" })
  }
})

// ---------- Instagram ----------

app.get("/api/instagram", async (req, res) => {
  const url = req.query.url

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "Valid Instagram URL required" })
  }

  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    })
    const html = await pageRes.text()

    const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/)
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)

    if (!videoMatch && !imageMatch) {
      return res.status(400).json({
        success: false,
        error: "Could not fetch this post. Instagram sometimes blocks access to certain content."
      })
    }

    res.json({
      success: true,
      title: titleMatch ? titleMatch[1] : "Instagram Post",
      type: videoMatch ? "video" : "image",
      mediaUrl: videoMatch ? videoMatch[1] : imageMatch[1]
    })

  } catch (err) {
    console.error("Instagram error:", err)
    res.status(500).json({ success: false, error: "Failed to fetch Instagram post" })
  }
})

// ---------- Fallback ----------

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.use((err, req, res, next) => {
  console.error("Server error:", err)
  res.status(500).json({ success: false, error: "Something went wrong on the server" })
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Downly is running on port ${PORT}`)
})

const express = require("express")
const path = require("path")

const app = express()
const PORT = process.env.PORT || 10000

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      return "YouTube"
    }

    if (host.includes("tiktok.com")) {
      return "TikTok"
    }

    if (host.includes("instagram.com")) {
      return "Instagram"
    }

    if (host.includes("pinterest.com") || host.includes("pin.it")) {
      return "Pinterest"
    }

    if (host.includes("facebook.com") || host.includes("fb.watch")) {
      return "Facebook"
    }

    return "Unknown"
  } catch {
    return "Unknown"
  }
}

function getYouTubeId(url) {
  try {
    const u = new URL(url)

    if (u.hostname.includes("youtu.be")) {
      return u.pathname.substring(1)
    }

    if (u.searchParams.get("v")) {
      return u.searchParams.get("v")
    }

    const match = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/)

    return match ? match[2] : null
  } catch {
    return null
  }
}

function getTikTokId(url) {
  const match = url.match(/\/video\/(\d+)/)

  return match ? match[1] : null
}

app.get("/api/analyze", async (req, res) => {
  const url = req.query.url

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Video URL is required"
    })
  }

  const platform = detectPlatform(url)

  let result = {
    success: true,
    platform,
    originalUrl: url,
    preview: null,
    downloadAvailable: false
  }

  if (platform === "YouTube") {
    const id = getYouTubeId(url)

    if (id) {
      result.preview = {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}`
      }
    }
  }

  if (platform === "TikTok") {
    const id = getTikTokId(url)

    if (id) {
      result.preview = {
        type: "tiktok",
        embedUrl: `https://www.tiktok.com/player/v1/${id}?description=1&music_info=1`
      }
    }
  }

  if (platform === "Instagram") {
    result.preview = {
      type: "instagram",
      embedUrl: url
    }
  }

  if (platform === "Facebook") {
    result.preview = {
      type: "facebook",
      embedUrl: url
    }
  }

  if (platform === "Pinterest") {
    result.preview = {
      type: "pinterest",
      embedUrl: url
    }
  }

  res.json(result)
})

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Downly is running on port ${PORT}`)
})

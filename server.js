const express = require("express")
const path = require("path")
const { Readable } = require("stream")
const posts = require("./posts")

const app = express()
const PORT = process.env.PORT || 10000
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function pageWrap(title, description, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #050505;
  color: white;
  line-height: 1.7;
}
.container {
  width: min(800px, 94%);
  margin: auto;
  padding: 40px 0;
}
a { color: #ff2855; text-decoration: none; }
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}
.nav a.logo { font-size: 22px; font-weight: bold; color: white; }
.nav a.logo span { color: #ff2855; }
h1 { font-size: clamp(28px, 6vw, 42px); margin-bottom: 8px; }
.date { color: #888; font-size: 14px; margin-bottom: 25px; display: block; }
.post-card {
  display: block;
  padding: 20px;
  border: 1px solid #292929;
  border-radius: 18px;
  background: #0c0c0c;
  margin-bottom: 15px;
}
.post-card h2 { margin: 0 0 8px; font-size: 20px; color: white; }
.post-card p { color: #aaa; margin: 0 0 8px; }
.post-content h2 { font-size: 22px; margin-top: 30px; }
.post-content p { color: #ccc; }
</style>
</head>
<body>
<div class="container">
  <div class="nav">
    <a href="/" class="logo">Down<span>ly</span></a>
    <a href="/blog">Blog</a>
  </div>
  ${bodyContent}
</div>
</body>
</html>`
}

// ---------- Blog list ----------

app.get("/blog", (req, res) => {
  const items = posts
    .slice()
    .reverse()
    .map(p => `
      <a href="/blog/${p.slug}" class="post-card">
        <h2>${escapeHtml(p.title)}</h2>
        <p>${escapeHtml(p.description)}</p>
        <span class="date">${p.date}</span>
      </a>
    `)
    .join("")

  const body = `<h1>Blog</h1>${items || "<p>No posts yet.</p>"}`

  res.send(pageWrap("Blog | Downly", "Guides and tips for downloading TikTok, Instagram, Pinterest, YouTube and Facebook videos.", body))
})

// ---------- Single blog post ----------

app.get("/blog/:slug", (req, res) => {
  const post = posts.find(p => p.slug === req.params.slug)

  if (!post) {
    return res.status(404).send(pageWrap("Not Found | Downly", "Post not found", "<h1>Post not found</h1><a href='/blog'>Back to Blog</a>"))
  }

  const body = `
    <a href="/blog">&larr; Back to Blog</a>
    <h1 style="margin-top:20px;">${escapeHtml(post.title)}</h1>
    <span class="date">${post.date}</span>
    <div class="post-content">${post.content}</div>
  `

  res.send(pageWrap(`${post.title} | Downly`, post.description, body))
})

// ---------- Analyze / Fetch media info ----------

app.post("/api/fetch", async (req, res) => {
  const url = req.body && req.body.url

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ success: false, error: "Valid URL required" })
  }

  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ success: false, error: "Server is missing API key configuration" })
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
    })

    const data = await apiRes.json()

    if (data.error || !data.medias || data.medias.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Could not fetch this link. It may be private, deleted, or unsupported."
      })
    }

    res.json({
      success: true,
      title: data.title || data.description || "Media",
      thumbnail: data.thumbnail || data.cover || data.picture || null,
      medias: data.medias.map(m => ({
        url: m.url,
        type: m.type,
        quality: m.quality || m.type,
        extension: m.extension || (m.type === "video" ? "mp4" : m.type === "audio" ? "mp3" : "jpg")
      }))
    })

  } catch (err) {
    console.error("Fetch error:", err)
    res.status(500).json({ success: false, error: "Failed to fetch this content. Try again." })
  }
})

// ---------- Direct download proxy ----------

app.get("/api/download-proxy", async (req, res) => {
  const url = req.query.url
  const filename = req.query.filename || "downly-file"

  if (!url || !isValidUrl(url)) {
    return res.status(400).send("Invalid URL")
  }

  try {
    const response = await fetch(url)

    if (!response.ok || !response.body) {
      return res.status(400).send("Could not fetch media")
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"

    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    Readable.fromWeb(response.body).pipe(res)

  } catch (err) {
    console.error("Proxy download error:", err)
    res.status(500).send("Failed to download")
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

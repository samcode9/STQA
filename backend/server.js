// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/userRoutes");
const { analyzeWebsiteHandler } = require("./controllers/analysisController");
//const { serveFixedPage } = require('./controllers/fixController');
const { serveFixedPage, getLastAnalysisResult } = require('./controllers/fixController');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static assets (HTML/CSS/JS) from /public
app.use(express.static(path.join(__dirname, "../public")));

// Configure EJS templating
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Connect to MongoDB
connectDB();

// Mount authentication routes
app.use("/", authRoutes); // handles /login and /signup

// Analysis endpoint (returns HTML or JSON based on request body)
app.post("/analyze", analyzeWebsiteHandler);
// Fix route
app.get('/fix', serveFixedPage);

app.get("/api/view/combined", async (req, res) => {
  const data = getLastAnalysisResult();
  if (!data || !data.html || !data.lastUrl) {
    return res.status(404).json({ error: "No analysis result available" });
  }

  const cheerio = require("cheerio");
  const axios   = require("axios");
  const $       = cheerio.load(data.html);

  // Gather <link rel="stylesheet">
  const links = $("link[rel='stylesheet']")
    .map((i, el) => $(el).attr("href"))
    .get()
    .filter(Boolean);

  let combinedCSS = "";
  for (const href of links) {
    try {
      const absolute = href.startsWith("http")
        ? href
        : new URL(href, data.lastUrl).href;
      const resp = await axios.get(absolute);
      combinedCSS += `/* from ${absolute} */\n` + resp.data + "\n\n";
    } catch (e) {
      console.warn("CSS fetch failed:", href, e.message);
    }
  }

  // Inline it
  $("link[rel='stylesheet']").remove();
  $("head").prepend(`<style>${combinedCSS}</style>`);

  // **Return the full HTML as JSON under `combined`**
  res.json({ combined: $.html() });
});



// Start the server
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

// Import required modules
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Function to analyze headings and contrast
async function analyzeWebsite(url) {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });

    const analysis = await page.evaluate(() => {
        let report = { headings: [], contrastIssues: [] };

        document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(h => {
            report.headings.push({ tag: h.tagName, text: h.innerText.trim(), fontSize: window.getComputedStyle(h).fontSize });
        });

        document.querySelectorAll("p, span, div").forEach(el => {
            let color = window.getComputedStyle(el).color;
            let bgColor = window.getComputedStyle(el).backgroundColor;
            if (color === bgColor) {
                report.contrastIssues.push({ element: el.innerText.trim(), issue: "⚠️ Low contrast detected" });
            }
        });

        return report;
    });

    await browser.close();
    return analysis;
}

// API Endpoint
app.post("/analyze", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "❌ URL is required" });

    try {
        const result = await analyzeWebsite(url);
        res.json(result);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "❌ Failed to analyze the website" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

// Import required modules
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Function to analyze the website for multiple WCAG accessibility parameters
async function analyzeWebsite(url) {
  // Launch Puppeteer with headless mode for stability
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Evaluate the page to extract accessibility issues
  const analysis = await page.evaluate(() => {
    let report = {
      headings: [],
      contrastIssues: [],
      keyboardIssues: [],
      altIssues: [],
      semanticIssues: [],
    };

    // 1. Heading Analysis: Capture all headings with their tag, text, and font size.
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      report.headings.push({
        tag: h.tagName,
        text: h.innerText.trim(),
        fontSize: window.getComputedStyle(h).fontSize,
      });
    });

    // 2. Contrast Issues: Flag elements (p, span, div) where text color equals background color.
    document.querySelectorAll("p, span, div").forEach((el) => {
      let color = window.getComputedStyle(el).color;
      let bgColor = window.getComputedStyle(el).backgroundColor;
      if (color === bgColor) {
        report.contrastIssues.push({
          element: el.innerText.trim(),
          issue: "⚠️ Low contrast detected",
        });
      }
    });

    // 3. Keyboard Accessibility / Focus Management:
    // Check all interactive elements for a visible focus indicator.
    document
      .querySelectorAll("a, button, input, textarea, select")
      .forEach((el) => {
        // Focus the element to trigger focus styling
        el.focus();
        let outlineStyle = window.getComputedStyle(el).outline;
        if (
          !outlineStyle ||
          outlineStyle === "none" ||
          outlineStyle === "0px none rgb(0, 0, 0)"
        ) {
          report.keyboardIssues.push({
            tag: el.tagName,
            text: el.innerText.trim(),
            issue: "❌ No visible focus indicator",
          });
        }
      });

    // 4. Alternative Text for Images:
    // For each image, check if the alt attribute is missing or empty.
    document.querySelectorAll("img").forEach((img) => {
      if (!img.alt || img.alt.trim() === "") {
        report.altIssues.push({
          element: img.src,
          issue: "❌ Missing alternative text (alt attribute)",
        });
      }
    });

    // 5. Semantic Markup:
    // Check if key semantic sections are present.
    if (!document.querySelector("header, [role='banner']")) {
      report.semanticIssues.push(
        "❌ Missing <header> or element with role='banner'"
      );
    }
    if (!document.querySelector("nav, [role='navigation']")) {
      report.semanticIssues.push(
        "❌ Missing <nav> or element with role='navigation'"
      );
    }
    if (!document.querySelector("main, [role='main']")) {
      report.semanticIssues.push(
        "❌ Missing <main> or element with role='main'"
      );
    }
    if (!document.querySelector("footer, [role='contentinfo']")) {
      report.semanticIssues.push(
        "❌ Missing <footer> or element with role='contentinfo'"
      );
    }

    return report;
  });

  await browser.close();
  return analysis;
}

// API Endpoint to analyze website
app.post("/analyze", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "❌ URL is required" });

  try {
    const result = await analyzeWebsite(url);
    res.json(result);
  } catch (error) {
    console.error("Error analyzing website:", error);
    res.status(500).json({ error: "❌ Failed to analyze the website" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
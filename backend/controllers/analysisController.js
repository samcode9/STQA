// controllers/analysisController.js
const puppeteer = require("puppeteer");

async function analyzeWebsite(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const report = await page.evaluate(() => {
    const r = {
      headings: [],
      contrastIssues: [],
      keyboardIssues: [],
      altIssues: [],
      semanticIssues: [],
    };

    // Headings
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      r.headings.push({
        tag: h.tagName,
        text: h.innerText.trim(),
        fontSize: getComputedStyle(h).fontSize,
      });
    });

    // Contrast helpers
    const lum = ([r, g, b]) => {
      const a = [r, g, b].map((v) =>
        (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const ratio = (fg, bg) => {
      const L1 = lum(fg),
        L2 = lum(bg);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    };
    const parseRGB = (s) => (s.match(/\d+/g) || []).map(Number);

    document.querySelectorAll("p, span, div").forEach((el) => {
      const fg = parseRGB(getComputedStyle(el).color);
      const bg = parseRGB(getComputedStyle(el).backgroundColor);
      const c = ratio(fg, bg).toFixed(2);
      if (c < 4.5) {
        r.contrastIssues.push({
          element: el.innerText.trim().substring(0, 100),
          contrastRatio: c,
          issue: "⚠️ Contrast ratio too low (needs at least 4.5:1)",
        });
      }
    });

    // Keyboard focus
    document
      .querySelectorAll("a,button,input,textarea,select")
      .forEach((el) => {
        el.focus();
        const o = getComputedStyle(el).outline;
        if (!o || o.includes("0px")) {
          r.keyboardIssues.push({
            tag: el.tagName,
            text: el.innerText.trim(),
            issue: "❌ No visible focus indicator",
          });
        }
      });

    // Alt text
    document.querySelectorAll("img").forEach((img) => {
      if (!img.alt || !img.alt.trim()) {
        r.altIssues.push({
          element: img.src,
          issue: "❌ Missing alternative text (alt attribute)",
        });
      }
    });

    // Semantic
    [
      ["header", "banner"],
      ["nav", "navigation"],
      ["main", "main"],
      ["footer", "contentinfo"],
    ].forEach(([sel, role]) => {
      if (!document.querySelector(`${sel},[role='${role}']`)) {
        r.semanticIssues.push(`❌ Missing <${sel}> or role='${role}'`);
      }
    });

    return r;
  });

  await browser.close();
  return report;
}

const analyzeWebsiteHandler = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });
  try {
    const result = await analyzeWebsite(url);
    res.json(result);
  } catch (err) {
    console.error("Error analyzing website:", err);
    res.status(500).json({ error: "Failed to analyze the website" });
  }
};

module.exports = { analyzeWebsiteHandler };

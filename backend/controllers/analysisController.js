/* backend/controllers/analysisController.js
const puppeteer = require("puppeteer");
const { setLastAnalysisResult } = require('./fixController');
// Core audit function that returns raw findings
async function analyzeWebsite(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  
  const raw = await page.evaluate(() => {
    
    // Initialize result structure
    const r = {
      headings: [],
      contrastIssues: [],
      keyboardIssues: [],
      altIssues: [],
      semanticIssues: [],
    };

    // 1. Collect Headings
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      r.headings.push({
        tag: h.tagName,
        text: h.innerText.trim(),
        fontSize: getComputedStyle(h).fontSize,
      });
    });

    // 2. Contrast Checks
    const lum = ([r, g, b]) => {
      const a = [r, g, b].map((v) =>
        (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const ratio = (fg, bg) => {
      const L1 = lum(fg);
      const L2 = lum(bg);
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
          suggestion:
            "Ensure text-background contrast ≥ 4.5:1 per WCAG 2.1 AA.",
        });
      }
    });

    // 3. Keyboard Focus
    document
      .querySelectorAll("a,button,input,textarea,select")
      .forEach((el) => {
        el.focus();
        const outline = getComputedStyle(el).outline;
        if (!outline || outline.includes("0px")) {
          r.keyboardIssues.push({
            tag: el.tagName,
            text: el.innerText.trim(),
            issue: "❌ No visible focus indicator",
            suggestion:
              "Add CSS :focus styles (e.g., outline: 3px solid #005fcc) per SC 2.4.7.",
          });
        }
      });

    // 4. Alt Text
    document.querySelectorAll("img").forEach((img) => {
      if (!img.alt || !img.alt.trim()) {
        r.altIssues.push({
          element: img.src,
          issue: "❌ Missing alternative text (alt attribute)",
          suggestion:
            "Add descriptive alt text (1–2 sentences) describing the image’s function per WCAG 1.1.1.",
        });
      }
    });

    // 5. Landmark Roles
    [
      ["header", "banner"],
      ["nav", "navigation"],
      ["main", "main"],
      ["footer", "contentinfo"],
    ].forEach(([sel, role]) => {
      if (!document.querySelector(`${sel},[role='${role}']`)) {
        r.semanticIssues.push({
          message: `❌ Missing <${sel}> or role='${role}'`,
          suggestion: `Include a <${sel}> or set role="${role}" per ARIA landmark guidance.`,
        });
      }
    });

    return r;
  });
  const html = await page.content();
  await browser.close();
  return {raw,html};
}

// Express handler for /analyze
const analyzeWebsiteHandler = async (req, res) => {
  const { url, format } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const { raw, html } = await analyzeWebsite(url);

    // Build summary and findings
    const summary = `Scanned ${url} against WCAG 2.1 AA. Found ${raw.contrastIssues.length} contrast issue(s), ${raw.altIssues.length} missing alt-text, and ${raw.keyboardIssues.length} focus issue(s).`;

    const findings = [];

    raw.contrastIssues.forEach((i) =>
      findings.push({
        criterion: "1.4.3 Contrast",
        severity: "high",
        details: `Snippet: "${i.element}" ratio ${i.contrastRatio}:1`,
        recommendation: i.suggestion,
      })
    );

    raw.altIssues.forEach((i) =>
      findings.push({
        criterion: "1.1.1 Alt Text",
        severity: "high",
        details: `Image URL: ${i.element}`,
        recommendation: i.suggestion,
      })
    );

    raw.keyboardIssues.forEach((i) =>
      findings.push({
        criterion: "2.4.7 Focus Indicator",
        severity: "medium",
        details: `<${i.tag}> "${i.text}"`,
        recommendation: i.suggestion,
      })
    );

    raw.semanticIssues.forEach((item) =>
      findings.push({
        criterion: "Landmark Roles",
        severity: "medium",
        details: item.message,
        recommendation: item.suggestion,
      })
    );

    raw.headings.forEach((h) =>
      findings.push({
        criterion: "2.4.6 Headings",
        severity: "low",
        details: `${h.tag} "${h.text}" at ${h.fontSize}`,
        recommendation: "Use sequential heading levels per SC 2.4.6.",
      })
    );
    setLastAnalysisResult({
      html,        // raw HTML string from page.content()
      issues: findings,
      url
    });    
    // Return JSON if requested
    if (format === "json") {
      return res.json({ summary, findings, raw });
    }

    // Otherwise, render HTML report via EJS
    return res.render("report", { summary, findings });
  } catch (err) {
    console.error("Error analyzing website:", err);
    return res.status(500).json({ error: "Failed to analyze the website" });
  }
};

module.exports = { analyzeWebsiteHandler };*/
// backend/controllers/analysisController.js

// backend/controllers/analysisController.js

const puppeteer = require("puppeteer");
const { setLastAnalysisResult } = require("./fixController");

/**
 * Build a simple unique selector for an element by climbing up to 5 levels.
 */


async function analyzeWebsite(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const raw = await page.evaluate(() => {
    const results = {
      contrastIssues: [],
      keyboardIssues: [],
      altIssues: [],
      semanticIssues: [],
      headings: [],
    };
    function buildSelector(el) {
    const path = [];
    let cur = el;
    for (let i = 0; cur && cur.tagName && path.length < 5; i++) {
      const tag = cur.tagName.toLowerCase();
      const siblings = Array.from(cur.parentNode.children)
        .filter(c => c.tagName === cur.tagName);
      const idx = siblings.indexOf(cur) + 1;
      path.unshift(`${tag}:nth-of-type(${idx})`);
      cur = cur.parentElement;
    }
    return path.join(" > ");
  }

    // helpers for contrast
    const lum = ([r,g,b]) => {
      r/=255; g/=255; b/=255;
      [r,g,b] = [r,g,b].map(v =>
        v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)
      );
      return 0.2126*r + 0.7152*g + 0.0722*b;
    };
    const ratio = (fg,bg) => {
      const L1 = lum(fg), L2 = lum(bg);
      return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    };
    const parseRGB = s => (s.match(/\d+/g)||[]).map(Number);

    // 1. Headings
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(h => {
      results.headings.push({
        tag: h.tagName,
        text: h.innerText.trim(),
        fontSize: getComputedStyle(h).fontSize,
        selector: buildSelector(h)
      });
    });

    // 2. Contrast on all text-bearing elements
    Array.from(document.querySelectorAll("*")).forEach(el => {
      const text = el.innerText.trim();
      if (!text) return;
      const style = window.getComputedStyle(el);
      let fg = parseRGB(style.color);
      let bgColor = style.backgroundColor;
      let p = el;
      while (bgColor === "rgba(0, 0, 0, 0)" && p.parentElement) {
        p = p.parentElement;
        bgColor = window.getComputedStyle(p).backgroundColor;
      }
      const bg = parseRGB(bgColor);
      if (fg.length!==3||bg.length!==3) return;
      const cr = ratio(fg,bg);
      if (cr < 4.5) {
        results.contrastIssues.push({
          selector: buildSelector(el),
          contrastRatio: cr.toFixed(2),
          issue: `Low contrast (${cr.toFixed(2)}:1)`,
          suggestion: "Ensure contrast ≥ 4.5:1 per WCAG 2.1 AA."
        });
      }
    });

    // 3. Keyboard focus
    document.querySelectorAll("a,button,input,textarea,select").forEach(el => {
      el.focus();
      const out = getComputedStyle(el).outline;
      if (!out || out==="0px") {
        results.keyboardIssues.push({
          selector: buildSelector(el),
          tag: el.tagName,
          issue: "No visible focus indicator",
          suggestion: "Add CSS :focus styles (e.g. outline:3px solid #005fcc)."
        });
      }
    });

    // 4. Alt text
    document.querySelectorAll("img").forEach(img => {
      if (!img.alt || !img.alt.trim()) {
        results.altIssues.push({
          selector: buildSelector(img),
          src: img.src,
          issue: "Missing alt attribute",
          suggestion: "Add descriptive alt text per WCAG 1.1.1."
        });
      }
    });

    // 5. Semantic
    [["header","banner"],["nav","navigation"],["main","main"],["footer","contentinfo"]]
      .forEach(([tag, role]) => {
        if (!document.querySelector(`${tag},[role='${role}']`)) {
          results.semanticIssues.push({
            selector: null,
            message: `Missing <${tag}> or role="${role}"`,
            suggestion: `Include <${tag}> or set role="${role}".`
          });
        }
      });

    return results;
  });

  const html = await page.content();
  await browser.close();
  return { raw, html };
}

const analyzeWebsiteHandler = async (req, res) => {
  const { url, format } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const { raw, html } = await analyzeWebsite(url);
    const findings = [];

    raw.contrastIssues.forEach(i =>
      findings.push({
        criterion: "1.4.3 Contrast",
        severity: "high",
        details: `Contrast ratio ${i.contrastRatio}:1`,
        selector: i.selector,
        recommendation: i.suggestion
      })
    );
    raw.keyboardIssues.forEach(i =>
      findings.push({
        criterion: "2.4.7 Focus Indicator",
        severity: "medium",
        details: `${i.tag}`,
        selector: i.selector,
        recommendation: i.suggestion
      })
    );
    raw.altIssues.forEach(i =>
      findings.push({
        criterion: "1.1.1 Alt Text",
        severity: "high",
        details: `Image src="${i.src}"`,
        selector: i.selector,
        recommendation: i.suggestion
      })
    );
    raw.semanticIssues.forEach(i =>
      findings.push({
        criterion: "ARIA Landmarks",
        severity: "medium",
        details: i.message,
        selector: i.selector,
        recommendation: i.suggestion
      })
    );
    raw.headings.forEach(h =>
      findings.push({
        criterion: "2.4.6 Headings",
        severity: "low",
        details: `Level: ${h.tag}, text: "${h.text}"`,
        selector: h.selector,
        recommendation: "Use sequential heading levels."
      })
    );

    // Store for fixController
    setLastAnalysisResult({ html, issues: findings, lastUrl: url });

    if (format === "json") {
      return res.json({ summary: `Found ${findings.length} issues.`, findings });
    }
    return res.render("report", {
      summary: `Analyzed ${url}; ${findings.length} issues found.`,
      findings
    });
  } catch (err) {
    console.error("Error analyzing website:", err);
    return res.status(500).json({ error: "Failed to analyze the website" });
  }
};

module.exports = { analyzeWebsiteHandler };


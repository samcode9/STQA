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

const cheerio = require("cheerio");

const analyzeWebsiteHandler = async (req, res) => {
  const { url, format } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const { raw, html } = await analyzeWebsite(url);
    const findings = [];

    const $ = cheerio.load(html);
    const lines = html.split('\n');

    const getLocationData = (selector) => {
      if (!selector) return { lineNumber: null, content: null };
      try {
        const element = $(selector).first();
        const outerHTML = $.html(element).trim();

        const lineIndex = lines.findIndex(line => line.includes(outerHTML));
        return {
          lineNumber: lineIndex >= 0 ? lineIndex + 1 : null,
          content: outerHTML
        };
      } catch {
        return { lineNumber: null, content: null };
      }
    };

    raw.contrastIssues.forEach(i => {
      const { lineNumber, content } = getLocationData(i.selector);
      findings.push({
        criterion: "1.4.3 Contrast",
        severity: "high",
        details: `Contrast ratio ${i.contrastRatio}:1`,
        selector: i.selector,
        lineNumber,
        content,
        recommendation: i.suggestion
      });
    });

    raw.keyboardIssues.forEach(i => {
      const { lineNumber, content } = getLocationData(i.selector);
      findings.push({
        criterion: "2.4.7 Focus Indicator",
        severity: "medium",
        details: `${i.tag}`,
        selector: i.selector,
        lineNumber,
        content,
        recommendation: i.suggestion
      });
    });

    raw.altIssues.forEach(i => {
      const { lineNumber, content } = getLocationData(i.selector);
      findings.push({
        criterion: "1.1.1 Alt Text",
        severity: "high",
        details: `Image src="${i.src}"`,
        selector: i.selector,
        lineNumber,
        content,
        recommendation: i.suggestion
      });
    });

    raw.semanticIssues.forEach(i => {
      const { lineNumber, content } = getLocationData(i.selector);
      findings.push({
        criterion: "ARIA Landmarks",
        severity: "medium",
        details: i.message,
        selector: i.selector,
        lineNumber,
        content,
        recommendation: i.suggestion
      });
    });

    raw.headings.forEach(h => {
      const { lineNumber, content } = getLocationData(h.selector);
      findings.push({
        criterion: "2.4.6 Headings",
        severity: "low",
        details: `Level: ${h.tag}, text: "${h.text}"`,
        selector: h.selector,
        lineNumber,
        content,
        recommendation: "Use sequential heading levels."
      });
    });

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



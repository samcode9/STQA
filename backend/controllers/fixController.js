const cheerio = require("cheerio");

let lastAnalysisResult = null;

function setLastAnalysisResult(result) {
  lastAnalysisResult = result;
}
function getLastAnalysisResult() {
  return lastAnalysisResult;
}

async function serveFixedPage(req, res) {
  const data = getLastAnalysisResult();
  if (!data || !data.html || !Array.isArray(data.issues)) {
    return res.status(400).send("No analysis result available");
  }

  // Load into Cheerio
  const $ = cheerio.load(data.html);

  data.issues.forEach(issue => {
    const sel = issue.selector;
    if (!sel) return;

    switch (issue.criterion) {
      case "1.4.3 Contrast":
        // Force contrast on matched elements
        $(sel).each((i, el) => {
          const $el = $(el);
          $el.css({
            color: "#000 !important",
            "background-color": "#fff !important"
          });
        });
        break;

      case "2.4.7 Focus Indicator":
        $(sel).each((i, el) => {
          const $el = $(el);
          // Append or merge outline style
          const existing = $el.attr("style") || "";
          $el.attr(
            "style",
            existing + (existing.endsWith(";") ? "" : ";") + "outline:3px solid #005fcc;"
          );
        });
        break;

      case "1.1.1 Alt Text":
        $(sel).each((i, el) => {
          const $el = $(el);
          if (!$el.attr("alt")) {
            $el.attr("alt", "Description added for accessibility");
          }
        });
        break;

      case "ARIA Landmarks":
        // For semantic issues, insert elements if missing
        // Use issue.message to decide
        if (issue.message.includes("<header>") && $("header").length === 0) {
          $("body").prepend("<header><h1>Header</h1></header>");
        }
        if (issue.message.includes("<nav>") && $("nav").length === 0) {
          $("header").after("<nav>Main Navigation</nav>");
        }
        if (issue.message.includes("<main>") && $("main").length === 0) {
          $("header, nav").last().after("<main>Main Content</main>");
        }
        if (issue.message.includes("<footer>") && $("footer").length === 0) {
          $("body").append("<footer>Footer Info</footer>");
        }
        break;

      case "2.4.6 Headings":
        // Enforce minimum font-size
        $(sel).each((i, el) => {
          const $el = $(el);
          const existing = $el.attr("style") || "";
          $el.attr(
            "style",
            existing + (existing.endsWith(";") ? "" : ";") + "font-size:32px;"
          );
        });
        break;
    }
  });

  // Output the fixed HTML
  res.set("Content-Type", "text/html");
  res.send($.html());
}

module.exports = { serveFixedPage, setLastAnalysisResult, getLastAnalysisResult };



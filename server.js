// Import required modules
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config(); 

// Add this line to allow requests from all origins
app.use(cors());

// Continue with your existing middleware
app.use(express.json());
const puppeteer = require("puppeteer");

const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('✅MongoDB connection error:', err));

const bcrypt = require('bcrypt');
const User = require('./models/User');  // Import the User model

// Login route
app.post('/login', async (req, res) => {
  console.log('Received login request:', req.body); // Log the request body
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    // If user does not exist
    if (!user) {
      console.log('User not found');
      return res.status(400).json({ message: 'User not found' });
    }

    // Log the user object from the database
    console.log('User found in DB:', user);

    // Log the entered password and the hashed password stored in DB
    console.log('Entered password:', password); 
    console.log('Stored hash in DB:', user.password);

    // Compare the entered password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', isMatch); // Log the password comparison result

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate a session or JWT (for authentication)
    const token = jwt.sign({ userId: user._id }, 'your-secret-key');
    return res.status(200).json({ success: true, message: 'Login successful', token });

  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});



app.use(express.json());

// POST route for user signup
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });

    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({
      email,
      password: hashedPassword,
    });

    // Save the user to the database
    await user.save();

    // Respond with success
    res.status(201).json({ success: true, message: 'User created successfully' });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



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

        // 2. Contrast Issues: Check contrast ratio between text color and background color.
    function getLuminance(r, g, b) {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928
          ? v / 12.92
          : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }

    function getContrastRatio(fg, bg) {
      const [r1, g1, b1] = fg;
      const [r2, g2, b2] = bg;
      const L1 = getLuminance(r1, g1, b1);
      const L2 = getLuminance(r2, g2, b2);
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function parseRGB(rgbString) {
      const match = rgbString.match(/\d+/g);
      return match ? match.map(Number) : [0, 0, 0];
    }

    document.querySelectorAll("p, span, div").forEach((el) => {
      const color = window.getComputedStyle(el).color;
      const bgColor = window.getComputedStyle(el).backgroundColor;

      const fgRGB = parseRGB(color);
      const bgRGB = parseRGB(bgColor);

      const ratio = getContrastRatio(fgRGB, bgRGB);
      if (ratio < 4.5) {
        report.contrastIssues.push({
          element: el.innerText.trim().substring(0, 100), // prevent too much text
          contrastRatio: ratio.toFixed(2),
          issue: "⚠️ Contrast ratio too low (needs at least 4.5:1)",
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
      report.semanticIssues.push("❌ Missing <header> or element with role='banner'");
    }
    if (!document.querySelector("nav, [role='navigation']")) {
      report.semanticIssues.push("❌ Missing <nav> or element with role='navigation'");
    }
    if (!document.querySelector("main, [role='main']")) {
      report.semanticIssues.push("❌ Missing <main> or element with role='main'");
    }
    if (!document.querySelector("footer, [role='contentinfo']")) {
      report.semanticIssues.push("❌ Missing <footer> or element with role='contentinfo'");
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
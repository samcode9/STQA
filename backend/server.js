const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/userRoutes");
const { analyzeWebsiteHandler } = require("./controllers/analysisController");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

connectDB();

app.use("/", authRoutes); // handles /login and /signup
app.post("/analyze", analyzeWebsiteHandler);

app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

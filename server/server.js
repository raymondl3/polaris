// server.js
require('dotenv').config(); // Load env vars first
const express = require('express');
const cors = require('cors');
const vision = require('@google-cloud/vision');
const ingredients = require('./ingredients'); // Import our logic

const app = express();

// Docker maps 8000->8000, so we default to 8000
const port = process.env.PORT || 8000;

// Google Vision Client 
// (It automatically finds credentials via GOOGLE_APPLICATION_CREDENTIALS env var)
const client = new vision.ImageAnnotatorClient();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large image payloads

// --- ROUTES ---

app.post('/api/scan-image', async (req, res) => {
  console.log("📍 Checkpoint 1: Request received!");
  
  try {
    const { image } = req.body;

    if (!image) {
      console.log("❌ Error: No image provided");
      return res.status(400).json({ error: 'No image provided' });
    }
    
    // Clean base64 string
    const base64Clean = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Clean, 'base64');

    console.log(`📍 Checkpoint 2: Calling Google Vision...`);

    // Call Google Vision API
    const [result] = await client.documentTextDetection({
      image: { content: buffer }
    });
    
    console.log("📍 Checkpoint 3: Google Vision responded!");

    if (!result.fullTextAnnotation) {
      return res.json({
        rawText: "",
        parsedIngredients: [],
        results: [],
        warning: "No text detected in image."
      });
    }

    // --- THE CRITICAL FIX ---
    // We call the 'analyze' function which coordinates everything
    const analysis = ingredients.analyze(result);

    console.log("📍 Checkpoint 4: Analysis complete. Sending response.");
    res.json(analysis);

  } catch (error) {
    console.error('💥 SERVER ERROR:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// --- START SERVER ---
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Polaris Backend running on http://0.0.0.0:${port}`);
});
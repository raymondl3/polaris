// server.js
const express = require('express');
const cors = require('cors');
const vision = require('@google-cloud/vision');

// FIX #3: Import the whole object so we can use 'ingredients.parseOCRText' or similar
const ingredients = require('./ingredients'); 

const app = express();

// FIX #1: Must match the internal Docker port (3000)
// Your Docker command maps 8000->3000. So we must listen on 3000 inside.
const port = process.env.PORT || 3000; 

const client = new vision.ImageAnnotatorClient();

// MIDDLEWARE
app.use(cors());
// This looks correct (Limit is BEFORE routes) ✅
app.use(express.json({ limit: '10mb' })); 

// THE ROUTE
app.post('/api/scan-image', async (req, res) => {
  console.log("📍 Checkpoint 1: Request received!");
  
  try {
    const { image } = req.body;

    if (!image) {
      console.log("❌ Error: No image provided");
      return res.status(400).json({ error: 'No image provided' });
    }
    console.log(`📍 Checkpoint 2: Image received (Length: ${image.length})`);

    const base64Clean = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Clean, 'base64');

    console.log("📍 Checkpoint 3: Calling Google Vision...");

    // FIX #2: Wrap the buffer in an object to prevent ENAMETOOLONG crash
    const [result] = await client.documentTextDetection({
      image: {
        content: buffer
      }
    });
    
    console.log("📍 Checkpoint 4: Google Vision responded!");

    if (!result.fullTextAnnotation) {
      return res.json({
        safe: true,
        matches: [],
        debug_text: "No text detected.",
        warning: "Image might be too blurry."
      });
    }

    // FIX #3 usage: Ensure this function name matches what is in ingredients.js
    // I am assuming your function is named 'parseOCRText' based on your imports
    // If your ingredients.js exports 'analyzeImageText', use that instead.
    const analysis = ingredients.parseOCRText(result);

    console.log("📍 Checkpoint 5: Analysis complete. Sending response.");
    res.json(analysis);

  } catch (error) {
    console.error('💥 SERVER ERROR:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// START SERVER
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Polaris Backend running on http://0.0.0.0:${port}`);
});
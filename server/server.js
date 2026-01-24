// server.js
const express = require('express');
const cors = require('cors');
const vision = require('@google-cloud/vision');
const { checkIngredient, parseOCRText } = require('./ingredients');

const app = express();
const port = 8000;

// --- 1. GOOGLE CLOUD SETUP ---
// We do NOT pass a keyFilename anymore. 
// It automatically finds the credentials you set up via terminal ('gcloud auth ...')
const client = new vision.ImageAnnotatorClient();

// --- 2. MIDDLEWARE ---
app.use(cors());

// INCREASE PAYLOAD LIMIT: Crucial for sending images as Base64 strings.
// the server will crash on large photos.
app.use(express.json({ limit: '10mb' }));

// --- 3. THE ROUTE ---
app.post('/api/scan-image', async (req, res) => {
  try {
    // Expecting: { "image": "BASE64_STRING_HERE" }
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // A. Send to Google Cloud Vision
    const [result] = await client.documentTextDetection({
      image: { content: image }
    });
    console.log("--- RAW GOOGLE VISION JSON ---");
    console.log(JSON.stringify(result, null, 2)); 
    console.log("-----------------------------------");

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return res.json({ 
        rawText: "", 
        results: [], 
        message: 'No text found in image.' 
      });
    }

    // B. Parse the Results
    // detections[0] is the full text block found in the image
    const fullText = detections[0].description;
    // Clean the text using our helper function
    const ingredientList = parseOCRText(fullText);

    // C. Analyze Ingredients
    // Map over every ingredient and check it against our Blocklist
    const analysis = ingredientList.map(item => checkIngredient(item));

    // D. Return the Data
    res.json({
      rawText: fullText,                // Debugging: What Google saw
      parsedIngredients: ingredientList,// Debugging: How we split it
      results: analysis                 // The actual Red/Green flags
    });

  } catch (error) {
    console.error('SERVER ERROR:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// 1. The Root Route (Homepage)
app.get('/', (req, res) => {
  res.send('Welcome to Project Polaris API 🚀');
});

// 2. The Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    service: 'backend'
  });
});

// --- 4. START SERVER ---
app.listen(port, () => {
  console.log(`Polaris server running on http://localhost:${port}`);
});
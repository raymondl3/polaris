const fs = require('fs');
const path = require('path');

// Make sure you have a 'label.png' in the same folder!
// const imagePath = path.join(__dirname, 'label.png');
const imagePath = path.join(__dirname, 'cropped_label.jpg');
const testServer = async () => {
  try {
    if (!fs.existsSync(imagePath)) {
      console.error("Error: label.jpg not found in this folder.");
      return;
    }

    console.log("Reading image...");
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    console.log(`Sending to API (${base64Image.length} chars)...`);
    
    const response = await fetch('http://127.0.0.1:8000/api/scan-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });

    const data = await response.json();

    console.log("\n--- GOOGLE VISION SAW ---");
    console.log("--------raw data---------")
    console.log(data.rawText);
    console.log("-------------------------");
    console.log(data.rawText ? data.rawText.slice(0, 100) + "..." : "Nothing");

    console.log("\n--- POLARIS ANALYSIS ---");
    data.results.forEach(r => {
      if(r.status === 'RED') console.log(`❌ [RED] ${r.originalText} -> (${r.category})`);
      else if(r.matchType === 'EXCEPTION') console.log(`✅ [SAFE] ${r.originalText} -> (${r.desc})`);
      else console.log(`✅ [SAFE] ${r.originalText}`);
    });

  } catch (error) {
    console.error("Test Failed:", error);
  }
};

testServer();
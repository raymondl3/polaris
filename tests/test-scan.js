// test-scan.js
const fs = require('fs');
const path = require('path');

// ⚠️ CHANGE THIS to your actual image filename
// const imagePath = path.join(__dirname, 'cropped_label.jpg'); 
const imagePath = path.join(__dirname, 'fixed_label.jpg'); 
// const imagePath = path.join(__dirname, 'label.png'); 

const testServer = async () => {
  try {
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Error: Image not found at ${imagePath}`);
      return;
    }

    console.log("Reading image...");
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    console.log(`Sending to API (${base64Image.length} chars)...`);
    
    // Note: Port 8000 to match Docker
    const response = await fetch('http://127.0.0.1:8000/api/scan-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });

    const data = await response.json();

    // Debugging Output
    console.log("\n--- GOOGLE VISION SAW ---");
    console.log(data.rawText ? data.rawText.slice(0, 150) + "..." : "Nothing detected");

    console.log("\n--- POLARIS ANALYSIS ---");
    
    if (data.results && data.results.length > 0) {
      data.results.forEach(r => {
        if(r.status === 'RED') {
          console.log(`❌ [RED]  ${r.originalText} --> (${r.category}: ${r.desc})`);
        } else if(r.matchType === 'EXCEPTION') {
          console.log(`✅ [SAFE] ${r.originalText} --> (Exception: ${r.desc})`);
        } else {
          console.log(`✅ [SAFE] ${r.originalText}`);
        }
      });
    } else {
      console.log("⚠️ No ingredients parsed.");
    }

  } catch (error) {
    console.error("Test Failed:", error);
  }
};

testServer();
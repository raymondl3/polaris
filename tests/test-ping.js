// Run this with: node test-ping.js
fetch('http://127.0.0.1:8000/api/scan-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: "tiny_test_string" }) 
})
.then(async res => {
    console.log("✅ STATUS:", res.status);
    console.log("✅ RESPONSE:", await res.text());
})
.catch(err => console.error("❌ ERROR:", err));
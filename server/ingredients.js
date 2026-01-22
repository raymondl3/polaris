const rawData = require('./blocklist.json');

// --- SETUP PHASE (Runs once) ---

const blocklistMap = new Map();
const exceptionsList = [];

rawData.forEach((group) => {
  // 1. Populate Blocklist Map
  group.keywords.forEach((keyword) => {
    blocklistMap.set(keyword.toLowerCase(), {
      id: group.id,
      category: group.category,
      displayName: group.display_name,
      status: group.status,
      desc: group.description
    });
  });

  // 2. Populate Exceptions List
  if (group.exceptions) {
    group.exceptions.forEach((exc) => {
      exceptionsList.push(exc.toLowerCase());
    });
  }
});

// Sort exceptions by length (Longest First) to prevent partial matching errors
exceptionsList.sort((a, b) => b.length - a.length);


// --- LOGIC PHASE (Runs per scan) ---

// Helper: Cleans up the messy Google Cloud text
const parseOCRText = (fullText) => {
  if (!fullText) return [];
  
  // Remove "Ingredients:" prefix and newlines
  let cleanText = fullText.replace(/^ingredients[:\s]*/i, '');
  cleanText = cleanText.replace(/\n/g, ' ');
  
  // Split by common delimiters
  let items = cleanText.split(/[,.]/);
  
  return items.map(i => i.trim()).filter(i => i.length > 0);
};

// Main Logic: The Checker
const checkIngredient = (scannedText) => {
  if (!scannedText) return null;

  let cleanText = scannedText.toLowerCase().trim();
  let foundException = null;

  // A. Check Exceptions (Allowlist)
  for (const exception of exceptionsList) {
    if (cleanText.includes(exception)) {
      foundException = exception;
      // Remove the exception from the text so it doesn't trigger flags
      cleanText = cleanText.replace(exception, " "); 
    }
  }

  // B. Tokenize remaining text
  const tokens = cleanText.split(/[\s,().]+/);

  // C. Check Blocklist
  for (const token of tokens) {
    if (!token) continue;
    
    const match = blocklistMap.get(token);
    if (match) {
      return {
        originalText: scannedText,
        matchType: 'BLOCK',
        matchedWord: token,
        ...match
      };
    }
  }

  // D. Return Result
  if (foundException) {
    return {
      originalText: scannedText,
      status: 'GREEN',
      category: 'Safe',
      matchType: 'EXCEPTION',
      desc: `identified as ${foundException}`
    };
  }

  return { 
    originalText: scannedText, 
    status: 'GREEN', 
    category: 'Safe',
    desc: 'No animal ingredients detected.'
  };
};

module.exports = { checkIngredient, parseOCRText };
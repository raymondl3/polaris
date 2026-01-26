// ingredients.js
const rawData = require('./blocklist.json');

// --- 1. SETUP PHASE (Runs once on startup) ---
const blocklistMap = new Map();
const exceptionsList = [];

rawData.forEach((group) => {
  // Populate Blocklist Map
  group.keywords.forEach((keyword) => {
    blocklistMap.set(keyword.toLowerCase(), {
      id: group.id,
      category: group.category,
      displayName: group.display_name,
      status: group.status,
      desc: group.description
    });
  });

  // Populate Exceptions List
  if (group.exceptions) {
    group.exceptions.forEach((exc) => {
      exceptionsList.push(exc.toLowerCase());
    });
  }
});

// Sort exceptions by length (Longest First) to prevent partial matching bugs
exceptionsList.sort((a, b) => b.length - a.length);


// --- 2. HELPER FUNCTIONS ---

// Extract text from Google's complex "Block" structure
const textFromBlock = (block) => {
  if (!block.paragraphs) return "";
  return block.paragraphs.map(p => 
    p.words.map(w => 
      w.symbols.map(s => s.text).join('')
    ).join(' ')
  ).join('\n');
};

// Smart Extraction: Looks for "Ingredients" blocks specifically
// UPDATED: Smart Extraction that looks at neighbors
const extractIngredientsByBlock = (visionResult) => {
  const fullAnnotation = visionResult.fullTextAnnotation;
  if (!fullAnnotation || !fullAnnotation.pages) return "";

  const blocks = fullAnnotation.pages[0].blocks;
  const validTextChunks = [];

  // Iterate through blocks to find "anchors"
  for (let i = 0; i < blocks.length; i++) {
    const text = textFromBlock(blocks[i]).toLowerCase();
    
    // Is this block a start of the ingredients list?
    if (text.includes('ingredients') || text.includes('contains:') || text.includes('ingrédients')) {
      
      // 1. Add THIS block (It might contain "Ingredients: Milk, Salt")
      validTextChunks.push(textFromBlock(blocks[i]));

      // 2. THE FIX: Look ahead! 
      // If the ingredients list continues to the next block, grab it too.
      // We assume the next block is relevant if it's close by.
      if (i + 1 < blocks.length) {
        validTextChunks.push(textFromBlock(blocks[i + 1]));
      }
    }
  }

  // If we found good chunks, join them
  if (validTextChunks.length > 0) {
    // Join with newlines to keep separation clear
    return validTextChunks.join('\n');
  }

  // Fallback: If logic failed, return EVERYTHING. 
  // It's better to be noisy than empty.
  console.log("⚠️ Block logic failed. Falling back to full text.");
  return fullAnnotation.text;
};

// Clean and split the text into a list
const parseStringIntoList = (fullText) => {
  if (!fullText) return [];
  
  // Remove "Ingredients:" prefix (case insensitive)
  let cleanText = fullText.replace(/^(ingredients|ingrédients)[:\s]*/i, '');
  // Remove newlines
  cleanText = cleanText.replace(/\n/g, ' ');
  
  // Split by commas or periods
  return cleanText.split(/[,.]/).map(i => i.trim()).filter(i => i.length > 0);
};

// The Safety Check Logic (Per Ingredient)
const checkSingleIngredient = (ingredientText) => {
  let cleanText = ingredientText.toLowerCase();
  let foundException = null;

  // A. Check Exceptions (Allowlist)
  for (const exception of exceptionsList) {
    if (cleanText.includes(exception)) {
      foundException = exception;
      cleanText = cleanText.replace(exception, " "); 
    }
  }

  // B. Check Blocklist (The "Bad" Words)
  const tokens = cleanText.split(/[\s,().]+/); // Split remaining text into words

  for (const token of tokens) {
    if (!token) continue;
    
    const match = blocklistMap.get(token);
    if (match) {
      return {
        originalText: ingredientText,
        matchType: 'BLOCK',
        matchedWord: token,
        status: match.status,      // RED
        category: match.category,
        desc: match.desc
      };
    }
  }

  // C. Return Result
  if (foundException) {
    return {
      originalText: ingredientText,
      status: 'GREEN',
      category: 'Safe',
      matchType: 'EXCEPTION',
      desc: `Cleared as ${foundException}`
    };
  }

  return { 
    originalText: ingredientText, 
    status: 'GREEN', 
    category: 'Safe',
    desc: 'No animal ingredients detected.'
  };
};


// --- 3. MAIN EXPORT ---

// The "Manager" function that Server.js calls
const analyze = (visionResult) => {
  // 1. Get raw text (smart extraction)
  const rawText = extractIngredientsByBlock(visionResult);
  
  // 2. Parse into list
  const ingredientList = parseStringIntoList(rawText);
  
  // 3. Check each item against database
  const results = ingredientList.map(item => checkSingleIngredient(item));

  // 4. Return the RICH OBJECT
  return {
    rawText: rawText,
    parsedIngredients: ingredientList,
    results: results
  };
};

module.exports = { analyze };
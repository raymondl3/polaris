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
const extractIngredientsByBlock = (visionResult) => {
  const fullAnnotation = visionResult.fullTextAnnotation;
  if (!fullAnnotation || !fullAnnotation.pages) return "";

  const blocks = fullAnnotation.pages[0].blocks;
  
  // Filter for blocks containing "ingredients" or "contains"
  const ingredientBlocks = blocks.filter(block => {
    const text = textFromBlock(block).toLowerCase();
    return text.includes('ingredients') || text.includes('contains:');
  });

  // If found specific blocks, use them. Otherwise, use full text.
  if (ingredientBlocks.length > 0) {
    return ingredientBlocks.map(b => textFromBlock(b)).join('\n');
  }
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
// ingredients.js
const rawData = require('./blocklist.json');

// --- 1. SETUP PHASE ---
const blocklistMap = new Map();
const exceptionsList = [];

// Common French words to filter out just in case
const FRENCH_STOPWORDS = new Set([
  'eau', 'sel', 'sucre', 'huile', 'lait', 'farine', 'amidon', 
  'vinaigre', 'arôme', 'colorant', 'épices', 'levure', 'blé', 
  'soja', 'maïs', 'moutarde'
]);

rawData.forEach((group) => {
  group.keywords.forEach((keyword) => {
    blocklistMap.set(keyword.toLowerCase(), {
      id: group.id,
      category: group.category,
      displayName: group.display_name,
      status: group.status,
      desc: group.description
    });
  });
  if (group.exceptions) {
    group.exceptions.forEach((exc) => exceptionsList.push(exc.toLowerCase()));
  }
});
exceptionsList.sort((a, b) => b.length - a.length);


// --- 2. HELPER FUNCTIONS ---

const textFromBlock = (block) => {
  if (!block.paragraphs) return "";
  return block.paragraphs.map(p => 
    p.words.map(w => 
      w.symbols.map(s => s.text).join('')
    ).join(' ')
  ).join('\n');
};

// Standard Extraction Logic (The Reverted Version)
const extractIngredientsByBlock = (visionResult) => {
  const fullAnnotation = visionResult.fullTextAnnotation;
  if (!fullAnnotation || !fullAnnotation.pages) return "";

  const blocks = fullAnnotation.pages[0].blocks;
  const validTextChunks = [];

  for (let i = 0; i < blocks.length; i++) {
    const text = textFromBlock(blocks[i]).toLowerCase();
    
    // Check keywords (We permit 'ingrédients' here just to catch the block)
    if (text.includes('ingredients') || text.includes('contains:') || text.includes('ingrédients')) {
      validTextChunks.push(textFromBlock(blocks[i]));

      if (i + 1 < blocks.length) {
        validTextChunks.push(textFromBlock(blocks[i + 1]));
      }
    }
  }

  if (validTextChunks.length > 0) {
    return validTextChunks.join('\n');
  }

  console.log("⚠️ Block logic failed. Falling back to full text.");
  return fullAnnotation.text;
};


// --- 3. CLEANING LOGIC (The Guillotine Fix) ---

const parseStringIntoList = (fullText) => {
  if (!fullText) return [];
  
  let cleanText = fullText;

  // 1. THE GUILLOTINE: Cut off French text
  // The moment we see "Ingrédients:" (French spelling) or "Contient:" (French Contains),
  // we split the string and only keep the FIRST part (Index 0).
  
  // Cut at "Ingrédients"
  cleanText = cleanText.split(/ingrédients[:\s]/i)[0];
  
  // Cut at "Contient" (Case insensitive)
  cleanText = cleanText.split(/contient[:\s]/i)[0];

  // 2. Remove Parentheses (e.g. "Water (Eau)")
  cleanText = cleanText.replace(/\s*\([^)]*\)/g, '');

  // 3. Remove Slashes (e.g. "Water/Eau")
  cleanText = cleanText.replace(/\s*\/.*?(?=[,.]|$)/g, '');

  // 4. Remove English Header Prefix
  cleanText = cleanText.replace(/^(ingredients)[:\s]*/i, '');
  
  // 5. Flatten newlines
  cleanText = cleanText.replace(/\n/g, ' ');

  // 6. Split and Filter
  const rawList = cleanText.split(/[,.]/).map(i => i.trim()).filter(i => i.length > 0);

  // 7. Stopword Filter (Safety net)
  return rawList.filter(item => !FRENCH_STOPWORDS.has(item.toLowerCase()));
};


// --- 4. CHECK LOGIC ---

const checkSingleIngredient = (ingredientText) => {
  let cleanText = ingredientText.toLowerCase();
  let foundException = null;

  for (const exception of exceptionsList) {
    if (cleanText.includes(exception)) {
      foundException = exception;
      cleanText = cleanText.replace(exception, " "); 
    }
  }

  const tokens = cleanText.split(/[\s,().]+/);
  for (const token of tokens) {
    if (!token) continue;
    const match = blocklistMap.get(token);
    if (match) {
      return {
        originalText: ingredientText,
        matchType: 'BLOCK',
        matchedWord: token,
        status: match.status,
        category: match.category,
        desc: match.desc
      };
    }
  }

  if (foundException) {
    return {
      originalText: ingredientText,
      status: 'GREEN',
      category: 'Safe',
      matchType: 'EXCEPTION',
      desc: `Cleared as ${foundException}`
    };
  }

  return { originalText: ingredientText, status: 'GREEN', category: 'Safe', desc: 'No animal ingredients detected.' };
};

const analyze = (visionResult) => {
  const rawText = extractIngredientsByBlock(visionResult);
  const ingredientList = parseStringIntoList(rawText);
  const results = ingredientList.map(item => checkSingleIngredient(item));
  return { rawText, parsedIngredients: ingredientList, results };
};

module.exports = { analyze };
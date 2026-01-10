import express from 'express';

const router = express.Router();

// Free translation using MyMemory API
// For production, consider Google Cloud Translation API or DeepL
const translateWithMyMemory = async (text, sourceLang, targetLang) => {
  try {
    // MyMemory doesn't support 'auto' - use empty source to let it auto-detect
    const langPair = sourceLang === 'auto' ? `|${targetLang}` : `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return {
        success: true,
        translatedText: data.responseData.translatedText,
        detectedLanguage: data.responseData.detectedLanguage || sourceLang,
        provider: 'mymemory'
      };
    }
    
    throw new Error(data.responseDetails || 'Translation failed');
  } catch (error) {
    console.error('MyMemory translation error:', error);
    throw error;
  }
};

// Alternative: LibreTranslate (self-hosted or public instance)
const translateWithLibreTranslate = async (text, sourceLang, targetLang) => {
  try {
    // Using the public LibreTranslate instance - for production, host your own
    const url = 'https://libretranslate.com/translate';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang === 'auto' ? 'auto' : sourceLang,
        target: targetLang,
        format: 'text'
      })
    });
    
    const data = await response.json();
    
    if (data.translatedText) {
      return {
        success: true,
        translatedText: data.translatedText,
        detectedLanguage: data.detectedLanguage?.language || sourceLang,
        provider: 'libretranslate'
      };
    }
    
    throw new Error(data.error || 'Translation failed');
  } catch (error) {
    console.error('LibreTranslate error:', error);
    throw error;
  }
};

// Google Translate free endpoint (most reliable fallback)
const translateWithGoogle = async (text, sourceLang, targetLang) => {
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Google translation request failed');
    
    const data = await response.json();
    if (data && data[0] && Array.isArray(data[0])) {
      const translated = data[0].map(item => item?.[0]).join('');
      if (translated) {
        return {
          success: true,
          translatedText: translated,
          detectedLanguage: data[2] || sourceLang,
          provider: 'google'
        };
      }
    }
    throw new Error('Google translation returned empty result');
  } catch (error) {
    console.error('Google Translate error:', error);
    throw error;
  }
};

// Main translation endpoint
router.post('/', async (req, res) => {
  try {
    const { text, sourceLang = 'auto', targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: 'text and targetLang are required' });
    }

    // Skip if source and target are the same
    if (sourceLang === targetLang && sourceLang !== 'auto') {
      return res.json({
        success: true,
        translatedText: text,
        detectedLanguage: sourceLang,
        provider: 'none'
      });
    }

    // Try Google first (most reliable)
    try {
      const result = await translateWithGoogle(text, sourceLang, targetLang);
      return res.json(result);
    } catch (googleError) {
      console.log('Google failed, trying MyMemory...');
    }

    // Fallback to MyMemory
    try {
      const result = await translateWithMyMemory(text, sourceLang, targetLang);
      return res.json(result);
    } catch (mmError) {
      console.log('MyMemory failed, trying LibreTranslate...');
    }

    // Fallback to LibreTranslate
    try {
      const result = await translateWithLibreTranslate(text, sourceLang, targetLang);
      return res.json(result);
    } catch (ltError) {
      console.error('All translation providers failed');
    }

    // Final fallback - return original text
    res.json({
      success: false,
      translatedText: text,
      error: 'All translation providers failed',
      provider: 'none'
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch translation endpoint
router.post('/batch', async (req, res) => {
  try {
    const { texts, sourceLang = 'auto', targetLang } = req.body;

    if (!Array.isArray(texts) || !targetLang) {
      return res.status(400).json({ error: 'texts array and targetLang are required' });
    }

    const results = await Promise.all(
      texts.map(async (text) => {
        try {
          const result = await translateWithMyMemory(text, sourceLang, targetLang);
          return { original: text, ...result };
        } catch (error) {
          return { 
            original: text, 
            translatedText: text, 
            success: false, 
            error: error.message 
          };
        }
      })
    );

    res.json({ results });
  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect language endpoint
router.post('/detect', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Use MyMemory's auto-detect feature
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=auto|en`;
    const response = await fetch(url);
    const data = await response.json();

    const detectedLang = data.responseData?.detectedLanguage || 'unknown';
    
    res.json({ 
      detectedLanguage: detectedLang,
      confidence: data.responseData?.match || 0
    });
  } catch (error) {
    console.error('Language detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get supported languages
router.get('/languages', (req, res) => {
  const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'th', name: 'Thai' },
    { code: 'sv', name: 'Swedish' },
    { code: 'da', name: 'Danish' },
    { code: 'fi', name: 'Finnish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'cs', name: 'Czech' },
    { code: 'el', name: 'Greek' },
    { code: 'he', name: 'Hebrew' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ms', name: 'Malay' },
    { code: 'ro', name: 'Romanian' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ta', name: 'Tamil' },
    { code: 'tl', name: 'Tagalog/Filipino' }
  ];
  
  res.json(supportedLanguages);
});

export default router;

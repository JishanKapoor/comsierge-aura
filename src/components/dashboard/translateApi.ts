const API_BASE = '/api';

export interface TranslationResult {
  success: boolean;
  translatedText: string;
  detectedLanguage?: string;
  provider: string;
  error?: string;
}

export interface Language {
  code: string;
  name: string;
}

// Translate text using backend API
export const translateText = async (
  text: string, 
  targetLang: string, 
  sourceLang: string = 'auto'
): Promise<TranslationResult> => {
  try {
    // Skip if no text or same language
    if (!text.trim() || (targetLang === sourceLang && sourceLang !== 'auto')) {
      return {
        success: true,
        translatedText: text,
        provider: 'none'
      };
    }

    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    
    if (!res.ok) throw new Error('Translation failed');
    return res.json();
  } catch (error) {
    console.error('Translation error:', error);
    // Fallback to direct MyMemory call
    return translateTextDirect(text, targetLang, sourceLang);
  }
};

// Direct translation fallback (same as original frontend implementation)
export const translateTextDirect = async (
  text: string, 
  targetLang: string, 
  sourceLang: string = 'auto'
): Promise<TranslationResult> => {
  if (!text.trim() || targetLang === 'en' && sourceLang === 'en') {
    return { success: true, translatedText: text, provider: 'none' };
  }

  try {
    const langPair = sourceLang === 'auto' ? `auto|${targetLang}` : `${sourceLang}|${targetLang}`;
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`
    );
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return {
        success: true,
        translatedText: data.responseData.translatedText,
        detectedLanguage: data.responseData.detectedLanguage,
        provider: 'mymemory'
      };
    }
    return { success: false, translatedText: text, provider: 'none', error: 'Translation failed' };
  } catch (error) {
    console.error('Direct translation failed:', error);
    return { success: false, translatedText: text, provider: 'none', error: String(error) };
  }
};

// Batch translate multiple texts
export const translateBatch = async (
  texts: string[], 
  targetLang: string, 
  sourceLang: string = 'auto'
): Promise<TranslationResult[]> => {
  try {
    const res = await fetch(`${API_BASE}/translate/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, sourceLang, targetLang }),
    });
    
    if (!res.ok) throw new Error('Batch translation failed');
    const data = await res.json();
    return data.results;
  } catch (error) {
    console.error('Batch translation error:', error);
    // Fallback to individual translations
    return Promise.all(texts.map(text => translateTextDirect(text, targetLang, sourceLang)));
  }
};

// Detect language of text
export const detectLanguage = async (text: string): Promise<{ detectedLanguage: string; confidence: number }> => {
  try {
    const res = await fetch(`${API_BASE}/translate/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    
    if (!res.ok) throw new Error('Language detection failed');
    return res.json();
  } catch (error) {
    console.error('Language detection error:', error);
    return { detectedLanguage: 'unknown', confidence: 0 };
  }
};

// Get supported languages
export const getSupportedLanguages = async (): Promise<Language[]> => {
  try {
    const res = await fetch(`${API_BASE}/translate/languages`);
    if (!res.ok) throw new Error('Failed to fetch languages');
    return res.json();
  } catch (error) {
    console.error('Error fetching languages:', error);
    // Return default list
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
    ];
  }
};

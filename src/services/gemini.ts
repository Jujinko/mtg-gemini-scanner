import { GoogleGenAI } from '@google/genai';

export function getAIClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('API Key environment variable is missing.');
  }
  return new GoogleGenAI({ apiKey: key });
}

export interface IdentificationResult {
  name?: string;
  set?: string;
  error?: string;
  errorObj?: Error;
}

export async function identifyCardFromImage(base64Image: string): Promise<IdentificationResult> {
  try {
    const ai = getAIClient();
    
    // Validate and strip the base64 prefix if present
    const base64Data = base64Image.includes(',') 
      ? base64Image.split(',')[1] 
      : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            },
            {
              text: 'You are an expert Magic: The Gathering identifier. Look at this image of an MTG card. Extract its exact English card name. If you can see the set symbol or set code, provide the set code (e.g. "NEO", "THB", "M21"). Return ONLY a JSON object in this format: { "name": "Card Name", "set": "Set Code" }. If it is clearly NOT an MTG card, return { "error": "No MTG card detected." }. Ensure the JSON is raw without markdown code blocks.',
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, // Low temperature for factual extraction
      }
    });

    const resultText = response.text;
    if (!resultText) {
      return { error: "No response from Gemini API" };
    }

    const parsed = JSON.parse(resultText) as IdentificationResult;
    return parsed;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return { error: error.message || "Failed to process image", errorObj: error instanceof Error ? error : new Error(String(error)) };
  }
}

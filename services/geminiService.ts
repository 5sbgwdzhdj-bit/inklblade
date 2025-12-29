
import { GoogleGenAI } from "@google/genai";

export const generateGamePoem = async (score: number): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player just finished an ink-wash style Wuxia game with a score of ${score}. 
      Generate a short, evocative "Death Poem" or martial arts evaluation in Chinese (Traditional or Simplified) and English translation. 
      The tone should be zen, poetic, and somber. Keep it under 50 words.`,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });
    return response.text || "墨迹散去，剑意长存。 (Ink fades, but the intent of the blade remains.)";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "墨尽，命绝。 (The ink is dry, the life is spent.)";
  }
};

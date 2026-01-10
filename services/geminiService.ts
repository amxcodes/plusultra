import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  // Ideally this is protected, but for this client-side demo we use the env var directly
  // In a real app, this should proxy through a backend or use strict controls
  if (!process.env.API_KEY) {
    console.warn("API_KEY is missing. Gemini features will not work.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getMovieRecommendation = async (userMood: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Please configure your API Key to use AI features.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a movie expert. Recommend a real movie based on this user mood: "${userMood}". 
      Return ONLY a short paragraph (max 50 words) describing the movie and why it fits the mood. 
      Do not format as markdown, just plain text.`,
    });
    
    return response.text || "I couldn't find a recommendation at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I'm having trouble connecting to the movie database right now.";
  }
};
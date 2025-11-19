import { GoogleGenAI } from "@google/genai";
import { GameResult } from "../types";

let genAI: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const getDealerCommentary = async (
  result: GameResult, 
  playerScore: number, 
  bankerScore: number,
  totalWon: number
): Promise<string> => {
  if (!genAI) return "Dealer smiles mysteriously.";

  const model = "gemini-2.5-flash";
  
  const prompt = `
    You are a sophisticated, witty, and slightly superstitious high-stakes Baccarat dealer in a top-tier casino.
    The hand just finished.
    Result: ${result.winner} won.
    Scores - Player: ${playerScore}, Banker: ${bankerScore}.
    The human player won a total of $${totalWon} on this hand (if 0, they lost or didn't bet on the winner).
    Banker winning with 6 is a "Super 6" (half payout).
    
    Provide a very short, one-sentence commentary to the player. 
    Be professional but have personality. If they won big, congratulate them. If they lost, offer a stoic consolation or encouragement.
    Do not mention specific rule mechanics unless it's a Super 6.
  `;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 60,
        temperature: 0.8
      }
    });
    return response.text?.trim() || "Place your bets, please.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "The cards speak for themselves.";
  }
};
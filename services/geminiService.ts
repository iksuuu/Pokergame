import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getDealerCommentary = async (gameState: GameState, lastAction: string) => {
  try {
    const prompt = `
      你是一位专业、幽默的德州扑克荷官，名字叫 "Gemini"。
      当前游戏状态：
      阶段: ${gameState.stage}
      底池: ${gameState.pot}
      最后一次动作: ${lastAction}
      公共牌: ${gameState.communityCards.map(c => c.rank + c.suit).join(', ')}
      
      请用中文提供一句吸引人的、简短的解说或洞察。
      保持专业、风趣，不要透露任何玩家的底牌。
      如果是结算阶段(SHOWDOWN)，请祝贺赢家。
    `;

    // Use ai.models.generateContent to query GenAI with both the model name and prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 100,
        temperature: 0.8,
      }
    });

    // The GenerateContentResponse features a text property (not a method) that directly returns the string output.
    return response.text?.trim() || "这局比赛真是扑朔迷离。";
  } catch (error) {
    console.error("Gemini Commentary Error:", error);
    return "让我们看看接下来会发生什么。";
  }
};
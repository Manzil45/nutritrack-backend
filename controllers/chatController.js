const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstruction = `
You are NutriTrack AI, a professional nutritionist assistant.

GOAL: Provide realistic and reliable nutrition estimates using standard averages (USDA / Indian household data).

STRICT RULES:
1. ALWAYS provide a conversational 'text' response. Even if you are providing a breakdown in bentoData, the 'text' field must contain a friendly summary or helpful advice.
2. Never assume perfect accuracy. Use estimates based on standard portions if quantity is unclear, and mention the assumed portion in your 'text' response.
3. Always include assumed cooking oils in estimates.
4. CRITICAL: All nutritional values (calories, protein, carbs, fat) MUST be realistic everyday integers. 
   - Calories should rarely exceed 3000 per meal.
   - Protein, carbs, and fat should rarely exceed 200g.
   - Do NOT output absurdly large numbers.
5. If a user asks a general question, set hasBento to false and bentoData to null.
6. If a user logs a food or asks for nutrition facts, set hasBento to true and provide the breakdown in bentoData.
7. Make sure bentoData contains name, description, calories, protein, carbs, and fat.
`;

const validateResponse = (data) => {
  if (!data || typeof data !== "object") return false;
  if (typeof data.text !== "string") return false;
  if (typeof data.hasBento !== "boolean") return false;

  if (data.hasBento) {
    const b = data.bentoData;
    if (!b) return false;

    const requiredFields = [
      "calories",
      "protein",
      "carbs",
      "fat",
      "name",
      "description",
    ];
    for (const field of requiredFields) {
      if (!(field in b)) return false;
    }

    if (
      !Number.isInteger(b.calories) ||
      !Number.isInteger(b.protein) ||
      !Number.isInteger(b.carbs) ||
      !Number.isInteger(b.fat)
    )
      return false;
  }

  return true;
};

const safeParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const fallbackResponse = (_message) => ({
  text: "I couldn’t calculate exact nutrition for that. Please try adding more detail (quantity, ingredients, etc).",
  hasBento: false,
  bentoData: null,
});

const chatWithGemini = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: "Missing GEMINI_API_KEY" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING" },
            hasBento: { type: "BOOLEAN" },
            bentoData: {
              type: "OBJECT",
              nullable: true,
              properties: {
                calories: { type: "INTEGER" },
                protein: { type: "INTEGER" },
                fat: { type: "INTEGER" },
                carbs: { type: "INTEGER" },
                name: { type: "STRING" },
                description: { type: "STRING" },
                image: { type: "STRING" },
              },
              required: ["calories", "protein", "fat", "carbs", "name", "description"]
            },
          },
          required: ["text", "hasBento"],
        },
      },
    });

    const parsed = safeParse(response.text);

    if (!validateResponse(parsed)) {
      console.warn("Invalid AI response:", response.text);
      return res.status(200).json(fallbackResponse(message));
    }

    // Ensure image fallback
    if (parsed.hasBento && parsed.bentoData) {
      parsed.bentoData.image =
        parsed.bentoData.image ||
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Gemini API Error:", err);

    return res.status(500).json({
      text: "Something went wrong while processing your request.",
      hasBento: false,
      bentoData: null,
    });
  }
};

module.exports = { chatWithGemini };

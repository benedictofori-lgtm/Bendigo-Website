import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. Add it as a server environment variable.");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static("."));

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    const response = await client.responses.create({
      model: "gpt-5.6-sol",
      instructions:
        "You are Bendigo AI, a friendly and helpful chatbot for the Bendigo Website. Keep answers clear and age-appropriate.",
      input: message.trim()
    });

    res.json({ reply: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Bendigo AI could not respond right now. Check the server configuration."
    });
  }
});

app.listen(port, () => {
  console.log(`Bendigo AI is running on port ${port}`);
});

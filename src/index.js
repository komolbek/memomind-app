import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Summarize transcript
app.post('/api/summarize', async (req, res) => {
  try {
    const { transcript, summaryLength, detectActions, suggestTags } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const lengthInstructions = {
      short: 'Create a brief 1-2 sentence summary',
      medium: 'Create a moderate 3-4 sentence summary',
      detailed: 'Create a comprehensive detailed summary',
    };

    let prompt = `You are an assistant that summarizes voice memos into structured notes.

Transcript:
"""
${transcript}
"""

Instructions:
- Generate a clear, concise title (max 6 words)
- ${lengthInstructions[summaryLength] || lengthInstructions.medium}
- Extract key points as a list (3-7 points)`;

    if (detectActions) {
      prompt += '\n- Identify any action items, tasks, or commitments mentioned';
    }

    if (suggestTags) {
      prompt += '\n- Suggest 2-4 relevant tags for categorization';
    }

    prompt += `

Respond in this exact JSON format:
{
  "title": "...",
  "summary": "...",
  "keyPoints": ["...", "..."],
  "actionItems": ["...", "..."],
  "suggestedTags": ["...", "..."]
}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes voice memos. Always respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    const result = JSON.parse(content);

    // Ensure all fields exist
    res.json({
      title: result.title || 'Voice Memo',
      summary: result.summary || '',
      keyPoints: result.keyPoints || [],
      actionItems: detectActions ? (result.actionItems || []) : [],
      suggestedTags: suggestTags ? (result.suggestedTags || []) : [],
    });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: 'Failed to summarize transcript' });
  }
});

app.listen(PORT, () => {
  console.log(`MemoMind backend running on port ${PORT}`);
});

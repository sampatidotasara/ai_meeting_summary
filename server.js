import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Groq from 'groq-sdk';
import { Resend } from 'resend';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cors());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- AI Summarization ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/summarize', async (req, res) => {
  try {
    const { transcript = '', instruction = '' } = req.body || {};
    if (!transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required.' });
    }

    const systemPrompt = `You are a helpful assistant that produces concise, structured meeting summaries.\n- Be faithful to the transcript.\n- Prefer bullet points.\n- If the user instruction asks, include: action items (with owners & due dates if present), key decisions, risks, and follow-ups.\n- Keep it tight and skimmable.`;

    const userPrompt = [
      instruction?.trim() ? `Instruction: ${instruction.trim()}` : 'Instruction: Summarize clearly in bullet points.',
      '',
      'Transcript:',
      transcript.length > 20000 ? transcript.slice(0, 20000) + '\n...[truncated]' : transcript
    ].join('\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1200
    });

    const content = completion.choices?.[0]?.message?.content || '';
    res.json({ summary: content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Summarization failed', details: String(err?.message || err) });
  }
});

// --- Email Sharing ---
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL || 'no-reply@example.com';

app.post('/api/share', async (req, res) => {
  try {
    const { to = [], subject = 'Meeting Summary', body = '' } = req.body || {};
    const recipients = Array.isArray(to) ? to : String(to).split(',').map(s => s.trim()).filter(Boolean);

    if (!recipients.length) return res.status(400).json({ error: 'Recipient email(s) required.' });
    if (!body.trim()) return res.status(400).json({ error: 'Email body required.' });

    if (!resendApiKey) {
      return res.status(501).json({ error: 'Email not configured. Set RESEND_API_KEY and FROM_EMAIL.' });
    }

    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      text: body
    });

    res.json({ ok: true, id: result?.data?.id || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Email send failed', details: String(err?.message || err) });
  }
});

// Fallback to index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));

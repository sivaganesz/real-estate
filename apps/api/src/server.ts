import { createApp } from './app';
import { connectDb } from './db/connect';
import { config } from './config';
import { seedIfEmpty } from './db/seed';
import { aiStatus } from './ai/client';

// EPHEMERAL_DB=1 gives a fresh in-memory database (used by the end-to-end tests).
const uri = await connectDb({ ephemeral: process.env.EPHEMERAL_DB === '1' });
await seedIfEmpty();
createApp().listen(config.port, () => {
  const ai = aiStatus();
  console.log(`EstateOS API on http://localhost:${config.port}  (db: ${uri.replace(/\/\/.*@/, '//***@')})`);
  console.log(ai.mode === 'gemini' ? `AI assistant: Google Gemini (${ai.model})` : 'AI assistant: offline mode — set GEMINI_API_KEY to use Gemini');
});

/// <reference types="vite/client" />
import { GoogleGenAI } from '@google/genai';
import { JUDGE_PROMPT } from '../prompts/judge-alpha';

function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('API Key environment variable is missing.');
  }
  return new GoogleGenAI({ apiKey: key });
}

export interface JudgeContext {
  active_player: string;
  phase: string;
  free_text: string;
}

export interface JudgeRequest {
  card_ids: string[];
  question: string;
  context: JudgeContext;
  prompt_version: string;
  model: string;
}

export interface JudgeResponse {
  tldr: string;
  steps: { ordinal: number; description: string; explanation?: string; rule_ref: string | null }[];
  citations: { type: 'ruling' | 'oracle'; card: string; text: string }[];
  insufficient: boolean;
  model_confidence: number;
  disclaimer: string;
}

import { ScryfallCard } from './scryfall'; // assume it exists

export async function askJudge(
  cards: ScryfallCard[],
  question: string,
  context: JudgeContext,
  options?: {
    signal?: AbortSignal;
    onProgress?: (status: string) => void;
    onRequestSent?: (prompt: string) => void;
  }
): Promise<{ response: JudgeResponse; meta: any }> {
  const startTime = Date.now();
  const modelToUse = 'gemini-2.5-pro';
  
  options?.onProgress?.('Cross-referencing oracle text and rulings...');
  
  // Format CARDS
  const cardsText = cards.map(c => {
    let text = `[Card: ${c.name}]\n`;
    text += `Type: ${c.type_line || ''}\n`;
    text += `Oracle text: ${c.oracle_text || 'None'}\n`;
    
    // Rulings - wait, we don't have them in ScryfallCard... Let's fetch them!
    return text;
  }).join('\n\n');

  // We need to fetch rulings for each card.
  const cardsDataWithRulings = await Promise.all(cards.map(async c => {
    try {
      const res = await fetch(`https://api.scryfall.com/cards/${c.id}/rulings`, { signal: options?.signal });
      if (res.ok) {
        const json = await res.json();
        return { ...c, rulings: json.data || [] };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
    }
    return { ...c, rulings: [] };
  }));

  options?.onProgress?.('Consulting the comprehensive rules...');

  const formattedCards = cardsDataWithRulings.map(c => {
    let t = `[Card: ${c.name}]\n`;
    t += `Type: ${c.type_line || ''}\n`;
    t += `Oracle text: ${c.oracle_text || 'None'}\n`;
    t += `Rulings:\n`;
    if (c.rulings.length === 0) t += `- None\n`;
    c.rulings.forEach((r: any) => {
      t += `- ${r.published_at}: ${r.comment}\n`;
    });
    return t;
  }).join('\n\n');

  let formattedContext = `- Active player: ${context.active_player}\n`;
  formattedContext += `- Turn phase: ${context.phase}\n`;
  formattedContext += `- Free text: "${context.free_text}"\n`;
  formattedContext += `- Question: "${question}"\n`;

  const prompt = JUDGE_PROMPT
    .replace('{{CARDS}}', formattedCards)
    .replace('{{CONTEXT}}', formattedContext);
    
  options?.onRequestSent?.(prompt);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('API Key environment variable is missing.');
  }

  const ai = new GoogleGenAI({ apiKey: key });

  console.log(`[Judge] Sending prompt to model: ${modelToUse}. Prompt length: ${prompt.length} chars`);
  
  const generatePromise = ai.models.generateContent({
    model: modelToUse,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt }
        ]
      }
    ],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const TIMEOUT_MS = 60000;
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request to Gemini timed out after 60s')), TIMEOUT_MS);
  });

  const abortPromise = new Promise<never>((_, reject) => {
    if (options?.signal?.aborted) {
      reject(new Error('Aborted'));
    }
    options?.signal?.addEventListener('abort', () => {
      reject(new Error('Aborted'));
    });
  });

  const promisesToRace = [generatePromise, timeoutPromise];
  if (options?.signal) {
    promisesToRace.push(abortPromise);
  }

  let result;
  try {
    options?.onProgress?.('Awaiting completion from Gemini (timeout: 60s)...');
    result = await Promise.race(promisesToRace) as any;
    options?.onProgress?.('Response received from Gemini.');
    console.log(`[Judge] Generate Content succeeded in ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.error('[Judge] Generate Content failed:', err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const latency_ms = Date.now() - startTime;
  const resultText = result.text;
  if (!resultText) {
    throw new Error('Empty response from model or invalid structure.');
  }

  const input_tokens = result.usageMetadata?.promptTokenCount || 0;
  const output_tokens = result.usageMetadata?.candidatesTokenCount || 0;
  
  // To be safe against markdown fences, but keep it simple
  let text = resultText.trim();
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }

  let responseJson: JudgeResponse;
  try {
    responseJson = JSON.parse(text) as JudgeResponse;
  } catch (err: any) {
    console.error('[Judge] Failed to parse response as JSON. Raw model output:', text);
    throw new Error('Model returned invalid JSON format.');
  }
  
  return {
    response: responseJson,
    meta: {
      latency_ms,
      input_tokens,
      output_tokens,
      error: null
    }
  };
}

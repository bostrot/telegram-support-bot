import { Context } from './interfaces';
import OpenAI from 'openai';
import cache from './cache';
import * as db from './db';
import * as log from 'fancy-log'

// Lazy-initialize OpenAI client to avoid issues when config isn't loaded (e.g., tests)
let llm: InstanceType<typeof OpenAI> | null = null;
function getLLM(): InstanceType<typeof OpenAI> {
    if (!llm) {
        llm = new OpenAI({
            apiKey: cache.config.llm_api_key,
            baseURL: cache.config.llm_base_url,
        });
    }
    return llm;
}

export interface TriageResult {
    category: string | null;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    summary: string;
    sentimentScore: number; // 1-5, 1 = very negative, 5 = positive
}

/**
 * Analyzes an incoming user message to classify category, priority, and sentiment.
 * Returns a structured triage result.
 */
export async function analyzeMessage(
    text: string,
    ticketId?: number,
): Promise<TriageResult | null> {
    if (!cache.config.auto_triage) return null;

    const categories = cache.config.categories || [];
    const categoryList = categories.map((c: any) => c.name).join(', ') || 'General';

    const systemPrompt = `You are a support ticket triage assistant. Analyze the customer message and return ONLY valid JSON with this exact structure:
{
  "category": "<one of: ${categoryList}, or null if unclear>",
  "priority": "<low, normal, high, or urgent>",
  "summary": "<brief one-line summary of the issue>",
  "sentimentScore": <number 1-5, where 1=very angry/frustrated, 3=neutral, 5=happy/satisfied>
}

Rules:
- Priority should be 'urgent' for complaints about outages, data loss, billing errors, or threats to leave.
- Priority should be 'high' for bugs affecting core functionality or repeated issues.
- Priority should be 'normal' for general questions and feature requests.
- Priority should be 'low' for minor suggestions or compliments.
- Sentiment score: 1 = very angry/threatening, 2 = frustrated/complaining, 3 = neutral, 4 = positive, 5 = very happy/grateful`;

    try {
        const response = await getLLM().chat.completions.create({
            model: cache.config.llm_model || 'gpt-3.5-turbo',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text },
            ],
        });

        const raw = response.choices[0]?.message?.content;
        if (!raw) return null;

        // Parse JSON from response (handle markdown code blocks)
        let jsonStr = raw.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\s*$/g, '');
        }

        const parsed: TriageResult = JSON.parse(jsonStr);

        // Validate and set defaults
        if (!['low', 'normal', 'high', 'urgent'].includes(parsed.priority)) {
            parsed.priority = 'normal';
        }
        if (parsed.sentimentScore < 1) parsed.sentimentScore = 1;
        if (parsed.sentimentScore > 5) parsed.sentimentScore = 5;

        // Store triage result in DB
        if (ticketId) {
            await db.setTriageInfo(
                ticketId,
                parsed.category,
                parsed.summary,
                parsed.sentimentScore,
            );
        }

        return parsed;
    } catch (error) {
        log.error("Error in triage analysis:", error);
        return null;
    }
}

/**
 * Formats the triage result as a prefix string to prepend to staff ticket messages.
 */
export function formatTriagePrefix(triage: TriageResult): string {
    if (!triage) return '';

    let prefix = '';

    // Sentiment alert
    const threshold = cache.config.sentiment_alert_threshold || 2;
    if (triage.sentimentScore <= threshold) {
        prefix += `${cache.config.language.sentimentAlert}\n`;
    }

    // Priority indicator
    const priorityIcons: Record<string, string> = {
        urgent: '🔴',
        high: '🟠',
        normal: '🟡',
        low: '⚪',
    };
    const icon = priorityIcons[triage.priority] || '🟡';
    prefix += `${icon} ${cache.config.language.triagePriority}: ${triage.priority.toUpperCase()}\n`;

    // Category
    if (triage.category) {
        prefix += `📂 ${cache.config.language.triageSummary}: ${triage.category}\n`;
    }

    // Summary
    if (triage.summary) {
        prefix += `📝 ${triage.summary}\n`;
    }

    return prefix ? `\n${prefix}\n` : '';
}

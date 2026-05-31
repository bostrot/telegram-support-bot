import { Context } from '../interfaces';
import OpenAI from 'openai';
import cache from '../cache';
import * as db from '../db'; // intentionally circular-safe at runtime since llm is imported lazily
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

/**
 * Builds conversation history messages for the LLM API.
 * Fetches last N messages from ticket_messages collection.
 */
async function buildConversationMessages(
    userMessage: string,
    ticketId?: number,
): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add conversation history if ticket ID is provided and memory is enabled
    if (ticketId && cache.config.llm_memory_depth > 0) {
        try {
            const history = await db.getConversationHistory(ticketId, cache.config.llm_memory_depth);
            for (const entry of history.reverse()) {
                const role = entry.sender === 'staff' || entry.sender === 'ai' ? 'assistant' : 'user';
                messages.push({ role, content: entry.text });
            }
        } catch (err) {
            log.error('Failed to load conversation history:', err);
        }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });
    return messages;
}

/**
 * Gets a response from the LLM for auto-replying to users.
 * Uses conversation memory if available.
 */
async function getResponseFromLLM(ctx: Context, ticketId?: number): Promise<string | null> {
    const systemPrompt = `You are a Support Agent. You have been assigned to help 
    the user based on the message and only the provided knowledge base. If the knowledge base
    does not contain the information needed to answer the user's question, you should respond
    with "null". Answer truthfully and to the best of your ability. Answer without
    salutation and greetings.\n\n
    Knowledgebase: """
    ${cache.config.llm_knowledge}
    """
    `;

    const conversationMessages = await buildConversationMessages(ctx.message.text, ticketId);

    let response = null;
    try {
        response = await getLLM().chat.completions.create({
            model: cache.config.llm_model || 'gpt-3.5-turbo',
            messages: [
                { content: systemPrompt, role: "system" },
                ...conversationMessages,
            ],
        });

        const message = response.choices[0]?.message?.content;
        if (message === "null" || message === "Null" || message === null) {
            return null;
        }
        return message;
    }
    catch (error) {
        log.error("Error in LLM response:", error);
        return null;
    }
}

/**
 * Generates a draft reply suggestion for staff members.
 */
async function getStaffAssistDraft(
    ctx: Context,
    ticketId?: number,
): Promise<string | null> {
    const systemPrompt = `You are an AI assistant helping a support agent respond to a customer. 
    Based on the conversation history and knowledge base below, draft a helpful response.
    Write in a professional but friendly tone. Do NOT include salutations or sign-offs — 
    just the body of the reply.\n\n
    Knowledgebase: """
    ${cache.config.llm_knowledge}
    """
    `;

    const conversationMessages = await buildConversationMessages(ctx.message.text, ticketId);

    try {
        const response = await getLLM().chat.completions.create({
            model: cache.config.llm_model || 'gpt-3.5-turbo',
            messages: [
                { content: systemPrompt, role: "system" },
                ...conversationMessages,
            ],
        });

        const message = response.choices[0]?.message?.content;
        return message || null;
    } catch (error) {
        log.error("Error in staff assist draft:", error);
        return null;
    }
}

/**
 * Translates text to the target language using LLM.
 */
async function translateText(
    text: string,
    sourceLang?: string,
): Promise<string | null> {
    if (!cache.config.translate_enabled) return null;
    const targetLang = cache.config.translate_target_language || 'en';

    try {
        const prompt = sourceLang
            ? `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translated text, nothing else:\n\n${text}`
            : `Detect the language of this text and translate it to ${targetLang}. Return ONLY the translated text, nothing else:\n\n${text}`;

        const response = await getLLM().chat.completions.create({
            model: cache.config.llm_model || 'gpt-3.5-turbo',
            messages: [
                { role: "system", content: "You are a professional translator. Always return only the translated text with no additional commentary." },
                { role: "user", content: prompt },
            ],
        });

        const translated = response.choices[0]?.message?.content;
        return translated || null;
    } catch (error) {
        log.error("Error in translation:", error);
        return null;
    }
}

export { getResponseFromLLM, getStaffAssistDraft, translateText };

import { Context } from '../interfaces';
import { openai } from "@llamaindex/openai";
import cache from '../cache';
import * as db from '../db';

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

const llm = openai({
    model: cache.config.llm_model,
    reasoningEffort: "low",
    apiKey: cache.config.llm_api_key,
    baseURL: cache.config.llm_base_url,
});

async function getResponseFromLLM(ctx: Context): Promise<string | null> {
    const systemPrompt = cache.config.llm_base_prompt + `\n\nKnowledgebase: """
    ${cache.config.llm_knowledge}
    """
    `;

    // Retrieve all messages for the user's ticket
    const ticket = await db.getTicketByUserId(ctx.message.from.id, ctx.session.groupCategory);
    if (!ticket) return null;

    const messages = await db.getMessagesByTicketId(ticket.ticketId);
    if (!messages || messages.length === 0) return null;

    const chatHistory: ChatMessage[] = messages.map(m => ({
        role: m.type === "user" ? "user" : "assistant",
        content: m.message,
    }));

    var response = null;
    try {
        response = await llm.chat({
            messages: [
                { content: systemPrompt, role: "system" },
                ...chatHistory,
            ],
        });
    } catch (error) {
        console.error("Error in LLM response:", error);
        return null;
    }

    const message = response.message.content.toString();
    if (message.toLowerCase() === "null" || !message) {
        return null;
    }

    return message;
}

export { getResponseFromLLM };

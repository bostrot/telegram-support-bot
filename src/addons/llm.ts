import { Context } from '../interfaces';
import cache from '../cache';
import * as db from '../db';
import {
    Settings,
    Document,
    VectorStoreIndex,
    RetrieverQueryEngine,
    SentenceSplitter,
} from 'llamaindex';
import { openai, OpenAIEmbedding } from '@llamaindex/openai';

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// Configure the LLM and embedding models with OpenAI
Settings.llm = openai({
    model: cache.config.llm_model,
    reasoningEffort: 'low',
    apiKey: cache.config.llm_api_key,
    baseURL: cache.config.llm_base_url,
});

Settings.embedModel = new OpenAIEmbedding({
    apiKey: cache.config.llm_api_key,
    baseURL: cache.config.llm_base_url,
    model: cache.config.llm_model_embedding,
});

Settings.nodeParser = new SentenceSplitter({
    chunkSize: 128,
    chunkOverlap: 64,
});

let queryEngine: RetrieverQueryEngine | null = null;

/**
 * Initializes the vector-based knowledge base index from the configured knowledge text.
 * Uses sentence splitting, embedding, and vector storage for efficient retrieval.
 * 
 * @returns A RetrieverQueryEngine instance ready to handle semantic queries.
 */
async function initializeKnowledgeBase(): Promise<RetrieverQueryEngine> {
    const kbText = cache.config.llm_knowledge;
    const doc = new Document({ text: kbText });
    const nodes = await Settings.nodeParser.getNodesFromDocuments([doc]);

    for (const node of nodes) {
        node.text = `passage: ${node.text}`;
    }

    const index = await VectorStoreIndex.fromDocuments(nodes);

    return index.asQueryEngine({
        similarityTopK: 4,
    });
}

/**
 * Generates a contextual response from the LLM by:
 * 1. Retrieving relevant passages from the vector store using the user's last message.
 * 2. Feeding the retrieved context and chat history to the OpenAI LLM.
 * 3. Returning the generated response or `null` if no relevant answer is possible.
 * 
 * @param ctx - The current user context containing session and message details.
 * @returns The assistant's reply as a string, or `null` if no valid response is generated.
 */
export async function getResponseFromLLM(ctx: Context): Promise<string | null> {
    if (!queryEngine) {
        try {
            queryEngine = await initializeKnowledgeBase();
        } catch (e) {
            console.error('Failed to initialize knowledge base index:', e);
            return null;
        }
    }

    const ticket = await db.getTicketByUserId(ctx.message.from.id, ctx.session.groupCategory);
    if (!ticket) return null;

    const messages = await db.getMessagesByTicketId(ticket.ticketId);

    const chatHistory: ChatMessage[] = messages.map(m => ({
        role: m.type === "user" ? "user" : "assistant",
        content: m.message,
    }));

    const latestUserMessage = [...chatHistory].reverse().find(m => m.role === 'user')?.content;
    if (!latestUserMessage) return null;

    let retrievedContext = '';
    try {
        const response = await queryEngine.query({ query: `query: ${latestUserMessage}` });
        retrievedContext = response.sourceNodes?.map(n => n.node.getContent).join('\n') || '';
    } catch (error) {
        console.error('Error querying knowledge base:', error);
        return null;
    }

    if (!retrievedContext.trim()) return 'null';

    const systemPrompt = `${cache.config.llm_base_prompt}\n\nKnowledgebase:\n${retrievedContext}`;

    try {
        const response = await Settings.llm.chat({
            messages: [
                { role: 'system', content: systemPrompt },
                ...chatHistory,
            ],
        });

        const message = response.message?.content?.toString().trim();
        return (!message || message.toLowerCase() === 'null') ? null : message;
    } catch (error) {
        console.error('Error in LLM response:', error);
        return null;
    }
}

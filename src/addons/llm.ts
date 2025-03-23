import { Context } from '../interfaces';
import { openai } from "@llamaindex/openai";
import cache from '../cache';

const llm = openai(
    {
        model: cache.config.llm_model,
        reasoningEffort: "low",
        apiKey: cache.config.llm_api_key,
        baseURL: cache.config.llm_base_url,
    }
);

async function getResponseFromLLM(ctx: Context): Promise<string> {
    const systemPrompt = `You are a Support Agent. You have been assigned to help 
    the user based on the message and only the provided knowledge base. If the knowledge base
    does not contain the information needed to answer the user's question, you should respond
    with "null". Answer truthfully and to the best of your ability. Answer without
    salutation and greetings.\n\n
    Knowledgebase: """
    ${cache.config.llm_knowledge}
    """
    `;
   
    const response = await llm.chat({
        messages: [
            { content: systemPrompt, role: "system" },
            { content: ctx.message.text, role: "user" }
        ],
    });

    const message = response.message.content.toString();
    if (message === "null" || message === "Null" || message === null) {
        return null
    }

    return message;
}

export { getResponseFromLLM };
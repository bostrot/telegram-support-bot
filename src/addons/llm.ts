import { Context } from '../interfaces';
import OpenAI from 'openai';
import cache from '../cache';

const llm = new OpenAI({
    apiKey: cache.config.llm_api_key,
    baseURL: cache.config.llm_base_url,
});

async function getResponseFromLLM(ctx: Context): Promise<string | null> {
    const systemPrompt = `You are a Support Agent. You have been assigned to help 
    the user based on the message and only the provided knowledge base. If the knowledge base
    does not contain the information needed to answer the user's question, you should respond
    with "null". Answer truthfully and to the best of your ability. Answer without
    salutation and greetings.\n\n
    Knowledgebase: """
    ${cache.config.llm_knowledge}
    """
    `;

    var response = null
    try {
        response = await llm.chat.completions.create({
            model: cache.config.llm_model || 'gpt-3.5-turbo',
            messages: [
                { content: systemPrompt, role: "system" },
                { content: ctx.message.text, role: "user" }
            ],
        });

        const message = response.choices[0]?.message?.content;
        if (message === "null" || message === "Null" || message === null) {
            return null
        }
        return message;
    }
    catch (error) {
        console.error("Error in LLM response:", error);
        return null;
    }
}

export { getResponseFromLLM };
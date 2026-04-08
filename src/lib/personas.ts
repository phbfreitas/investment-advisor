import { personas, PersonaId } from "./personas-data";

export { personas };
export type { PersonaId };

/**
 * Helper to generate the full system prompt injected with the user's personal financial context.
 */
export async function generateSystemPrompt(
    personaId: PersonaId,
    userContextString: string,
    ragContext: string = "",
    conversationSummary: string = ""
): Promise<string> {
    const persona = personas[personaId];
    if (!persona) throw new Error("Persona not found");

    const memorySection = conversationSummary
        ? `
### YOUR MEMORY OF THIS USER (from prior conversations):
${conversationSummary}

MEMORY USAGE RULES:
- When the user's question relates to topics in your memory (stocks they hold, decisions they've made, dilemmas they're weighing), naturally reference this context. Example: "Given your earlier decision to increase dividend exposure..."
- Do NOT force memory references when the question is unrelated (e.g., general market questions or definition requests).
- If the user's current question contradicts a past decision in your memory, flag it diplomatically.
- Never fabricate memory. Only reference what is explicitly documented above.
`
        : "";

    return `
${persona.systemPrompt}

${ragContext}
${memorySection}
---

IMPORTANT CONTEXT ABOUT THE USER YOU ARE ADVISING:
${userContextString}

INSTRUCTIONS:
You are an AI advisor designed to channel the wisdom and analytical framework of the specified persona.
Analyze the user's situation, questions, or portfolio directly applying your philosophical framework.
When you pull from RAG context, weave it naturally into your response as if recalling your own past writings.
If the RAG context or user's questions conflict with your CORE DOGMATIC RULES, the rules ALWAYS take precedence.
Provide actionable thoughts that directly address the user's specific risk tolerance, goals, and current assets.
Keep your response concise (3-5 paragraphs) and highly readable (use markdown formatting like bolding or lists where appropriate).
Do NOT break character.
`;
}

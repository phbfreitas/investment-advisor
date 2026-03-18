import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const { getRagContext } = require("../src/lib/rag");

async function main() {
    const personaId = process.argv[2] || "buffett";
    console.log(`Testing RAG retrieval for persona: ${personaId}\n`);

    const query = "What are your core investment principles and philosophy?";
    console.log(`Query: "${query}"\n`);

    const context = await getRagContext(personaId, query, 2);
    console.log(context || "(No RAG context returned — index may not exist yet)");
}

main().catch(console.error);

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const { getRagContext } = require("../src/lib/rag");

async function main() {
    console.log("Testing RAG retrieval for Warren Buffett...\n");
    const query = "What are your thoughts on cigar butt investing and buying fair businesses at wonderful prices?";
    console.log(`Query: "${query}"\n`);

    // getRagContext handles the embedding of the query and cosine similarity search
    const context = await getRagContext("buffett", query, 2);

    console.log(context);
}

main().catch(console.error);

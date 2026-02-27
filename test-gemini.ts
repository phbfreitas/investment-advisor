import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName: string) {
    console.log(`Testing ${modelName} heavily...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        for (let i = 0; i < 5; i++) {
            const result = await model.generateContent("Hello?");
            console.log(`✅ ${modelName} iter ${i} works.`);
        }
    } catch (e: any) {
        console.error(`❌ ${modelName} failed: ${e.message}`);
    }
}

async function main() {
    const modelsToTest = [
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest"
    ];

    for (const m of modelsToTest) {
        await testModel(m);
    }
}

main();

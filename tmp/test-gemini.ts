import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            // For @google/generative-ai 0.24.1, systemInstruction might need to be structured differently depending on the exact version, but let's test if this simple string crashes.
            systemInstruction: "You are an elite, highly intelligent Chief Investment Officer. Your communication style is immaculate, highly structured, and visually scannable. You abhor 'wall of text' responses. You structure every response utilizing Markdown headers, bullet points, bold text for emphasis on metrics, and tables where data is compared. Be crisp, professional, and actionable."
        });

        console.log("Model initialized, starting stream...");
        const resultStream = await model.generateContentStream("Say hello and tell me about Apple stock in 1 sentence.");

        console.log("Stream acquired. Reading chunks...");
        for await (const chunk of resultStream.stream) {
            process.stdout.write(chunk.text());
        }
        console.log("\nDone!");
    } catch (e) {
        console.error("\nCRASH DETECTED:");
        console.error(e);
    }
}

test();

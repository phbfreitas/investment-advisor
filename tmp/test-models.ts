import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
    try {
        console.log("--- Testing Chat Persona Route Configuration (gemini-2.5-flash) ---");
        const chatModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: "You are Warren Buffett."
        });

        const chatStartTime = Date.now();
        const chatResult = await chatModel.generateContent("Explain value investing in one sentence.");
        const chatDuration = Date.now() - chatStartTime;
        console.log(`\nChat Model Response (${chatDuration}ms):\n${chatResult.response.text()}\n`);


        console.log("--- Testing Guidance Route Configuration (gemini-3.1-pro-preview) ---");
        const proModel = genAI.getGenerativeModel({
            model: "gemini-3.1-pro-preview",
            systemInstruction: "You are an elite, highly intelligent Chief Investment Officer. Your communication style is immaculate, highly structured, and visually scannable. You abhor 'wall of text' responses. You structure every response utilizing Markdown headers, bullet points, bold text for emphasis on metrics, and tables where data is compared. Be crisp, professional, and actionable."
        });

        const proStartTime = Date.now();
        console.log("Streaming response from Pro model...");
        const proStream = await proModel.generateContentStream("Write a very short summary (2 bullet points) regarding Apple stock (AAPL).");

        for await (const chunk of proStream.stream) {
            process.stdout.write(chunk.text());
        }
        const proDuration = Date.now() - proStartTime;
        console.log(`\n\nPro Model Stream Completed (${proDuration}ms).\n`);

    } catch (e) {
        console.error("\nERROR RUNNING TEST:");
        console.error(e);
    }
}

testModels();

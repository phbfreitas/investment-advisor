import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenerativeAI } from '@google/generative-ai';

const modelsToTest = [
    'gemini-flash-latest',
    'gemini-2.0-flash-lite-001',
    'gemma-3-12b-it',
    'gemini-pro-latest',
    'gemini-2.5-flash-lite'
];

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    for (const m of modelsToTest) {
        console.log(`Testing model: ${m}...`);
        const model = genAI.getGenerativeModel({
            model: m
        });

        try {
            const res = await model.generateContent('hello');
            console.log(`SUCCESS for ${m}:`, res.response.text());
        } catch (e: any) {
            console.error(`ERROR for ${m}: ${e.message}\n`);
        }
    }
}
test();

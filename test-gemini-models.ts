import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (data && data.models) {
        data.models.forEach((m: any) => {
            if (m.name.includes("flash")) {
                console.log(m.name, m.supportedGenerationMethods);
            }
        });
    } else {
        console.log(data);
    }
}

listModels();

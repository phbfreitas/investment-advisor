/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: "investment-advisor",
            removal: input?.stage === "production" ? "retain" : "remove",
            home: "aws",
            providers: {
                aws: {
                    region: "us-east-1",
                },
            },
        };
    },
    async run() {
        const { config: dotenvConfig } = await import("dotenv");
        dotenvConfig({ path: ".env.local" });

        new sst.aws.Nextjs("InvestmentAdvisorWeb", {
            environment: {
                DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData",
                GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
                NEXTAUTH_URL: "https://d1gy53tpahfbj6.cloudfront.net",
                NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "fksjdflkjsdoiewuroiwueoiruwoieurwoieruowier",
                GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
                GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
                NODE_ENV: "production",
            },
            permissions: [
                {
                    actions: ["dynamodb:*"],
                    resources: ["*"],
                },
            ],
            server: {
                timeout: "60 seconds",
            },
            domain: undefined, // Add your custom domain here if you buy one later!
        });
    },
});

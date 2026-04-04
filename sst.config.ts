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
                    version: "7.20.0",
                },
            },
        };
    },
    async run() {
        const { config: dotenvConfig } = await import("dotenv");
        dotenvConfig({ path: ".env.local" });

        // Application-level encryption key — "Blind Admin" design
        // DO NOT delete this key. Deletion window is 30 days; all encrypted data would be permanently lost.
        const encryptionKey = new aws.kms.Key("InvestmentAdvisorEncryptionKey", {
            description: "Investment Advisor application-level encryption key (Blind Admin)",
            enableKeyRotation: true,
            deletionWindowInDays: 30,
        });

        new aws.kms.Alias("InvestmentAdvisorEncryptionKeyAlias", {
            name: $interpolate`alias/investment-advisor-${$app.stage}`,
            targetKeyId: encryptionKey.id,
        });

        // S3 bucket for dynamic RAG indexes (Money Guy rolling article index)
        const dynamicRagBucket = new sst.aws.Bucket("DynamicRagBucket");

        // Standalone Lambda for refreshing the Money Guy dynamic article index
        const moneyGuyRefreshFn = new sst.aws.Function("MoneyGuyRefreshFn", {
            handler: "functions/refresh-moneyguy.handler",
            timeout: "5 minutes",
            memory: "512 MB",
            environment: {
                GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
                DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData",
                DYNAMIC_RAG_BUCKET: dynamicRagBucket.name,
            },
            permissions: [
                {
                    actions: ["s3:PutObject", "s3:GetObject"],
                    resources: [$interpolate`${dynamicRagBucket.arn}/*`],
                },
                {
                    actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
                    resources: ["*"],
                },
            ],
        });

        // Daily cron: fires every day, Lambda decides internally whether refresh is due
        new sst.aws.Cron("MoneyGuyRefreshCron", {
            schedule: "rate(1 day)",
            job: moneyGuyRefreshFn.arn,
        });

        new sst.aws.Nextjs("InvestmentAdvisorWeb", {
            environment: {
                DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData",
                GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
                NEXTAUTH_URL: "https://d1gy53tpahfbj6.cloudfront.net",
                NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "fksjdflkjsdoiewuroiwueoiruwoieurwoieruowier",
                GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
                GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
                NODE_ENV: "production",
                KMS_KEY_ID: encryptionKey.id,
                DYNAMIC_RAG_BUCKET: dynamicRagBucket.name,
            },
            permissions: [
                {
                    actions: ["dynamodb:*"],
                    resources: ["*"],
                },
                {
                    actions: [
                        "kms:GenerateDataKey",
                        "kms:Decrypt",
                        "kms:Encrypt",
                        "kms:DescribeKey",
                    ],
                    resources: [encryptionKey.arn],
                },
                {
                    actions: ["s3:GetObject"],
                    resources: [$interpolate`${dynamicRagBucket.arn}/*`],
                },
            ],
            server: {
                timeout: "60 seconds",
            },
            domain: undefined, // Add your custom domain here if you buy one later!
        });
    },
});

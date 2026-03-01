const { LambdaClient, ListFunctionsCommand } = require("@aws-sdk/client-lambda");
const { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogStreamsCommand } = require("@aws-sdk/client-cloudwatch-logs");

const REGION = process.env.AWS_REGION || "us-east-1";
const lambdaClient = new LambdaClient({ region: REGION });
const cwClient = new CloudWatchLogsClient({ region: REGION });

async function main() {
    try {
        const listCmd = new ListFunctionsCommand({});
        const functions = await lambdaClient.send(listCmd);

        const webFunc = functions.Functions.find(f => f.FunctionName.includes("InvestmentAdvisorWeb"));
        if (!webFunc) {
            console.log("Could not find web function.");
            return;
        }

        console.log("Found function:", webFunc.FunctionName);
        const logGroupName = `/aws/lambda/${webFunc.FunctionName}`;

        console.log("Fetching logs for group:", logGroupName);

        const streamsCmd = new DescribeLogStreamsCommand({
            logGroupName,
            orderBy: "LastEventTime",
            descending: true,
            limit: 3
        });

        const streams = await cwClient.send(streamsCmd);
        if (!streams.logStreams || streams.logStreams.length === 0) {
            console.log("No log streams found.");
            return;
        }

        for (const stream of streams.logStreams) {
            console.log("--- Stream:", stream.logStreamName, "---");
            const filterCmd = new FilterLogEventsCommand({
                logGroupName,
                logStreamNames: [stream.logStreamName],
                limit: 50
            });
            const events = await cwClient.send(filterCmd);
            for (const event of events.events || []) {
                console.log(event.message);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

main();

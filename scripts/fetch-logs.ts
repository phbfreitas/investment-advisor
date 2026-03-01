import { CloudWatchLogsClient, DescribeLogGroupsCommand, FilterLogEventsCommand, DescribeLogStreamsCommand } from "@aws-sdk/client-cloudwatch-logs";

const REGION = process.env.AWS_REGION || "us-east-1";
const cwClient = new CloudWatchLogsClient({ region: REGION });

async function main() {
    try {
        const lgCmd = new DescribeLogGroupsCommand({ limit: 50, logGroupNamePrefix: "/aws/lambda/in-production-InvestmentAdvisorWeb" });
        const groups = await cwClient.send(lgCmd);

        if (!groups.logGroups || groups.logGroups.length === 0) {
            console.log("No log groups found.");
            return;
        }

        for (const group of groups.logGroups) {
            if (!group.logGroupName?.includes("Useast1Function")) continue;

            console.log("Found log group:", group.logGroupName);

            const streamsCmd = new DescribeLogStreamsCommand({
                logGroupName: group.logGroupName,
                orderBy: "LastEventTime",
                descending: true,
                limit: 3
            });

            const streams = await cwClient.send(streamsCmd);
            if (!streams.logStreams || streams.logStreams.length === 0) {
                console.log("No log streams found for", group.logGroupName);
                continue;
            }

            for (const stream of streams.logStreams) {
                console.log("--- Stream:", stream.logStreamName, "---");
                const filterCmd = new FilterLogEventsCommand({
                    logGroupName: group.logGroupName,
                    logStreamNames: [stream.logStreamName || ""],
                    limit: 100
                });
                const events = await cwClient.send(filterCmd);
                for (const event of events.events || []) {
                    console.log(event.message);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

main();

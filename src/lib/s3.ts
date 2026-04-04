import { S3Client, GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

/**
 * Fetch a JSON object from S3. Returns null if the object does not exist yet
 * (before first refresh) or if DYNAMIC_RAG_BUCKET is not configured.
 */
export async function fetchS3Json<T>(bucket: string, key: string): Promise<T | null> {
    if (!bucket) return null;
    try {
        const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = await response.Body?.transformToString();
        if (!body) return null;
        return JSON.parse(body) as T;
    } catch (e) {
        if (e instanceof NoSuchKey) {
            // Bucket exists but object not yet written — before first cron run
            return null;
        }
        console.error(`[S3] Failed to fetch s3://${bucket}/${key}:`, e);
        return null;
    }
}

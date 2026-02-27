import { PrismaClient } from "@prisma/client";

// PrismaClient is attached to the \`global\` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const getPrisma = () => {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = new PrismaClient({
            log: ["query"],
        });
    }
    return globalForPrisma.prisma;
};
export const prisma = new Proxy({} as PrismaClient, {
    get(target, prop, receiver) {
        const client = getPrisma();
        return Reflect.get(client, prop, receiver);
    }
});

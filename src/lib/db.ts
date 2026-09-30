import { Pool } from "pg";
import { requireEnv } from "./config";

const globalForPool = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool {
    if (!globalForPool.pgPool) {
        globalForPool.pgPool = new Pool({
            connectionString: requireEnv("DATABASE_URL"),
            max: 5,
        });
    }
    return globalForPool.pgPool;
}

// pgvector accepts vectors as text like "[0.1,0.2,0.3]"
export function toVectorLiteral(vector: number[]): string {
    return `[${vector.join(",")}]`;
}
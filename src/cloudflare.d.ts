// Minimal types for the Worker bindings the site uses. Wrangler's generated runtime types
// (`wrangler types`) clash with the DOM lib the rest of the site compiles against.
declare module "cloudflare:workers" {
    export const env: { DB: D1Database };
}

interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    run(): Promise<unknown>;
}

interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

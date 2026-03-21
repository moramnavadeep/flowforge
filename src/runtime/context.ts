/**
 * FlowForge Scoped Dependency Injection Context
 *
 * Services are registered by intent-token name and resolved at runtime.
 * No manual wiring, no decorator magic, no reflection.
 *
 * The ForgeContext is scoped per-request (using AsyncLocalStorage) or
 * as a global singleton — your choice.
 *
 * Usage (singleton):
 *   const ctx = new ForgeContext();
 *   ctx.provide("db", () => drizzleClient);
 *   ctx.provide("mailer", () => new Mailer());
 *
 *   // In a handler:
 *   const db = ctx.resolve("db");
 *
 * Usage (request-scoped):
 *   app.use(ctx.requestMiddleware());
 *   // In handler:
 *   const db = ForgeContext.current().resolve("db");
 */

import { AsyncLocalStorage } from "async_hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

type Factory<T> = () => T;

interface Registration<T> {
    factory: Factory<T>;
    singleton: boolean;
    instance?: T;
}

// ─── ForgeContext ─────────────────────────────────────────────────────────────

export class ForgeContext {
    private registry = new Map<string, Registration<unknown>>();
    private static storage = new AsyncLocalStorage<ForgeContext>();

    /**
     * Register a service factory by token name.
     *
     * @param token - Intent-style token e.g. "db", "mailer", "auth.service"
     * @param factory - A function that creates/returns the service instance
     * @param singleton - If true (default), the instance is created once and cached
     */
    provide<T>(token: string, factory: Factory<T>, singleton = true): this {
        this.registry.set(token, { factory: factory as Factory<unknown>, singleton });
        return this;
    }

    /**
     * Resolve a service by its token.
     * Throws a descriptive error if the token is not registered.
     */
    resolve<T>(token: string): T {
        const reg = this.registry.get(token);
        if (!reg) {
            throw new ForgeContextError(token, [...this.registry.keys()]);
        }
        if (reg.singleton) {
            if (reg.instance === undefined) {
                reg.instance = reg.factory();
            }
            return reg.instance as T;
        }
        return reg.factory() as T;
    }

    /**
     * Check if a token is registered.
     */
    has(token: string): boolean {
        return this.registry.has(token);
    }

    /**
     * List all registered token names.
     */
    listTokens(): string[] {
        return [...this.registry.keys()];
    }

    /**
     * Reset a singleton instance (force re-creation on next resolve).
     * Useful in tests between test cases.
     */
    reset(token: string): void {
        const reg = this.registry.get(token);
        if (reg) reg.instance = undefined;
    }

    /**
     * Clear all registrations. Use in test teardowns.
     */
    clear(): void {
        this.registry.clear();
    }

    // ─── Request-scoped context via AsyncLocalStorage ────────────────────────

    /**
     * Express middleware: binds this context to the current async request scope.
     * After mounting, use `ForgeContext.current()` in handlers to get the request context.
     */
    requestMiddleware(): (
        req: import("express").Request,
        res: import("express").Response,
        next: import("express").NextFunction,
    ) => void {
        return (_req, _res, next) => {
            ForgeContext.storage.run(this, next);
        };
    }

    /**
     * Get the ForgeContext bound to the current async request scope.
     * Must be called from within a `requestMiddleware()` chain.
     *
     * @throws ForgeContextError if called outside of a scoped context
     */
    static current(): ForgeContext {
        const ctx = ForgeContext.storage.getStore();
        if (!ctx) {
            throw new Error(
                "ForgeContext.current() called outside of a request scope.\n" +
                "Make sure you've mounted ctx.requestMiddleware() on your Express app.",
            );
        }
        return ctx;
    }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class ForgeContextError extends Error {
    constructor(public readonly token: string, public readonly available: string[]) {
        super(
            `FlowForge Context: No service registered for token "${token}".\n` +
            `Available tokens:\n${available.map((t) => `  • "${t}"`).join("\n")}`,
        );
        this.name = "ForgeContextError";
    }
}

// ─── Global singleton context ─────────────────────────────────────────────────

/** App-wide global context — use for services shared across all requests. */
export const forgeContext = new ForgeContext();

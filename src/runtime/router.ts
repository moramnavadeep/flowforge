/**
 * FlowForge Intent Router
 *
 * Unlike traditional URL routers, the Intent Router maps *action intents*
 * to handler functions. Handlers are registered by intent string, not by HTTP path.
 *
 * This decouples your business logic from HTTP transport — the same handler
 * can be invoked from an HTTP route, a WebSocket message, a scheduled job, or a CLI command.
 *
 * Usage:
 *   const router = new IntentRouter();
 *   router.register("list Students", async (ctx) => { ... your logic ... });
 *   router.register("create Student", async (ctx) => { ... });
 *
 *   // Mount onto Express
 *   app.use(forgeExpressAdapter(router, graph));
 */

import type { ForgeGraph, ResolvedRoute } from "../dsl/types.js";

// ─── Context ─────────────────────────────────────────────────────────────────

export interface IntentContext {
    /** The parsed intent string e.g. "list Students" */
    intent: string;
    /** Path parameters e.g. { id: "abc123" } */
    params: Record<string, string>;
    /** Parsed request body */
    body: unknown;
    /** Query string parameters */
    query: Record<string, string | string[]>;
    /** Authenticated user (if auth is configured) */
    user?: {
        id: string;
        roles: string[];
        [key: string]: unknown;
    };
    /** Custom metadata bag — attach anything */
    meta: Record<string, unknown>;
}

export type IntentHandler = (ctx: IntentContext) => Promise<unknown>;

export interface IntentMatch {
    route: ResolvedRoute;
    handler: IntentHandler;
}

// ─── Intent Router ────────────────────────────────────────────────────────────

export class IntentRouter {
    private handlers = new Map<string, IntentHandler>();
    private graph: ForgeGraph | null = null;

    /**
     * Attach a ForgeGraph for route introspection (optional but recommended).
     */
    withGraph(graph: ForgeGraph): this {
        this.graph = graph;
        return this;
    }

    /**
     * Register a handler for an intent string.
     * The intent string must match what's defined in your `.forge.yaml`.
     *
     * @example
     *   router.register("list Students", async (ctx) => {
     *     return await db.select().from(students);
     *   });
     */
    register(intent: string, handler: IntentHandler): this {
        this.handlers.set(intent.toLowerCase().trim(), handler);
        return this;
    }

    /**
     * Register multiple handlers at once.
     */
    registerMany(handlers: Record<string, IntentHandler>): this {
        for (const [intent, handler] of Object.entries(handlers)) {
            this.register(intent, handler);
        }
        return this;
    }

    /**
     * Resolve and execute a handler by intent string.
     * Returns the handler result or throws if no handler is registered.
     */
    async dispatch(intent: string, ctx: Partial<IntentContext> = {}): Promise<unknown> {
        const key = intent.toLowerCase().trim();
        const handler = this.handlers.get(key);
        if (!handler) {
            throw new ForgeIntentNotFoundError(intent, [...this.handlers.keys()]);
        }
        const fullCtx: IntentContext = {
            intent,
            params: {},
            body: {},
            query: {},
            meta: {},
            ...ctx,
        };
        return handler(fullCtx);
    }

    /**
     * Check if a handler is registered for an intent.
     */
    has(intent: string): boolean {
        return this.handlers.has(intent.toLowerCase().trim());
    }

    /**
     * List all registered intents (useful for debugging/introspection).
     */
    listIntents(): string[] {
        return [...this.handlers.keys()];
    }

    /**
     * Get a report of all intents in the graph and their handler registration status.
     * Helps you find unimplemented intents during development.
     */
    auditGraph(): { intent: string; handled: boolean; route: string }[] {
        if (!this.graph) return [];
        return this.graph.routes.map((r) => ({
            intent: r.intent,
            handled: this.has(r.intent),
            route: `${r.method.toUpperCase()} ${r.path}`,
        }));
    }
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ForgeIntentNotFoundError extends Error {
    constructor(public readonly intent: string, public readonly available: string[]) {
        super(
            `FlowForge: No handler registered for intent "${intent}".\n` +
            `Available intents:\n${available.map((i) => `  • "${i}"`).join("\n")}`,
        );
        this.name = "ForgeIntentNotFoundError";
    }
}

// ─── Express adapter ──────────────────────────────────────────────────────────

/**
 * Creates an Express middleware that bridges the Intent Router to Express.
 * Maps each ForgeGraph route to its registered intent handler.
 *
 * @example
 *   import express from "express";
 *   import { forgeExpressAdapter } from "@workspace/flowforge/runtime";
 *
 *   const app = express();
 *   const intentRouter = new IntentRouter().withGraph(graph);
 *   // register handlers...
 *   app.use("/api", forgeExpressAdapter(intentRouter, graph));
 */
export function forgeExpressAdapter(
    intentRouter: IntentRouter,
    graph: ForgeGraph,
): (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void {
    // Build a lookup: "METHOD /path" → intent
    const lookup = new Map<string, string>();
    for (const route of graph.routes) {
        lookup.set(`${route.method} ${route.path}`, route.intent);
    }

    return (req, res, next) => {
        const key = `${req.method.toLowerCase()} ${req.route?.path ?? req.path}`;
        const intent = lookup.get(key);
        if (!intent) return next();

        intentRouter
            .dispatch(intent, {
                params: req.params as Record<string, string>,
                body: req.body,
                query: req.query as Record<string, string>,
                user: (req as unknown as Record<string, unknown>).user as IntentContext["user"],
                meta: {},
            })
            .then((result) => res.json({ data: result }))
            .catch(next);
    };
}

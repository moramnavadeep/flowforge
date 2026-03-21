/**
 * FlowForge Reactive Event Bus
 *
 * Entities emit lifecycle events ("Student.created", "Order.deleted", etc.).
 * Subscribers are registered by event pattern — either exact match or wildcard.
 *
 * Events declared in your `.forge.yaml` are automatically wired at startup.
 * Custom subscribers can be added programmatically.
 *
 * Usage:
 *   const bus = new ForgeEventBus();
 *
 *   bus.on("Student.created", async (event) => {
 *     await sendWelcomeEmail(event.data.email);
 *   });
 *
 *   bus.on("*.deleted", async (event) => {
 *     await auditLog.record(event);
 *   });
 *
 *   await bus.emit("Student.created", { id: "123", name: "Alice" });
 */

import type { ForgeGraph, ForgeEvent } from "../dsl/types.js";

// ─── Event types ──────────────────────────────────────────────────────────────

export interface ForgeEventPayload<T = unknown> {
    /** Event name e.g. "Student.created" */
    event: string;
    /** The entity name e.g. "Student" */
    entity: string;
    /** The lifecycle action e.g. "created" */
    action: string;
    /** Event data payload */
    data: T;
    /** ISO timestamp of when the event occurred */
    timestamp: string;
    /** Unique event ID */
    id: string;
}

export type ForgeEventHandler<T = unknown> = (payload: ForgeEventPayload<T>) => Promise<void> | void;

// ─── Pattern matcher ──────────────────────────────────────────────────────────

function matchesPattern(pattern: string, event: string): boolean {
    if (pattern === "*") return true;
    if (pattern === event) return true;
    const [pe, pa] = pattern.split(".");
    const [ee, ea] = event.split(".");
    return (pe === "*" || pe === ee) && (pa === "*" || pa === ea);
}

// ─── Event Bus ───────────────────────────────────────────────────────────────

export class ForgeEventBus {
    private subscriptions: Array<{
        pattern: string;
        handler: ForgeEventHandler;
        once: boolean;
    }> = [];

    private errorHandler: ((err: unknown, event: string) => void) | null = null;

    /**
     * Subscribe to an event pattern.
     * Supports wildcards: "Student.*", "*.created", "*"
     */
    on<T = unknown>(pattern: string, handler: ForgeEventHandler<T>): () => void {
        const sub = { pattern, handler: handler as ForgeEventHandler, once: false };
        this.subscriptions.push(sub);
        return () => this.off(pattern, handler as ForgeEventHandler);
    }

    /**
     * Subscribe to an event pattern — fires once then auto-unsubscribes.
     */
    once<T = unknown>(pattern: string, handler: ForgeEventHandler<T>): void {
        this.subscriptions.push({ pattern, handler: handler as ForgeEventHandler, once: true });
    }

    /**
     * Unsubscribe a specific handler from a pattern.
     */
    off(pattern: string, handler: ForgeEventHandler): void {
        this.subscriptions = this.subscriptions.filter(
            (s) => !(s.pattern === pattern && s.handler === handler),
        );
    }

    /**
     * Register a global error handler for failed event subscriptions.
     */
    onError(handler: (err: unknown, event: string) => void): void {
        this.errorHandler = handler;
    }

    /**
     * Emit an event and invoke all matching subscribers.
     * Returns a promise that resolves when all handlers have settled.
     */
    async emit<T = unknown>(eventName: string, data: T): Promise<void> {
        const [entity = "unknown", action = "unknown"] = eventName.split(".");
        const payload: ForgeEventPayload<T> = {
            event: eventName,
            entity,
            action,
            data,
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID(),
        };

        const matching = this.subscriptions.filter((s) => matchesPattern(s.pattern, eventName));
        const toRemove: typeof this.subscriptions = [];

        await Promise.allSettled(
            matching.map(async (sub) => {
                try {
                    await sub.handler(payload as ForgeEventPayload<unknown>);
                } catch (err) {
                    if (this.errorHandler) {
                        this.errorHandler(err, eventName);
                    } else {
                        console.error(`[FlowForge EventBus] Error in handler for "${eventName}":`, err);
                    }
                }
                if (sub.once) toRemove.push(sub);
            }),
        );

        if (toRemove.length > 0) {
            this.subscriptions = this.subscriptions.filter((s) => !toRemove.includes(s));
        }
    }

    /**
     * Wire event declarations from a ForgeGraph automatically.
     * Each `events` entry in your `.forge.yaml` becomes a subscriber.
     */
    wireGraph(graph: ForgeGraph, effects: Record<string, ForgeEventHandler>): void {
        for (const forgeEvent of graph.events) {
            const handler = effects[forgeEvent.do];
            if (!handler) {
                console.warn(
                    `[FlowForge EventBus] No effect handler registered for "${forgeEvent.do}" (declared in spec)`,
                );
                continue;
            }
            this.on(forgeEvent.on, handler);
        }
    }

    /**
     * Return a list of all active subscriptions (for debugging).
     */
    listSubscriptions(): Array<{ pattern: string; once: boolean }> {
        return this.subscriptions.map(({ pattern, once }) => ({ pattern, once }));
    }
}

// ─── Singleton bus ────────────────────────────────────────────────────────────

/** Global singleton event bus — import from anywhere in your app. */
export const forgeBus = new ForgeEventBus();

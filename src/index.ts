/**
 * FlowForge — Public API
 *
 * Import from "@workspace/flowforge" to use the DSL parser,
 * runtime engine, and code generators in your own code.
 */

// DSL
export { parseForgeSpec } from "./dsl/schema.js";
export type {
    ForgeApp,
    ForgeGraph,
    ForgeEntity,
    ResolvedEntity,
    ForgeField,
    ForgeScalar,
    ForgeRouteDef,
    ResolvedRoute,
    ForgeView,
    ResolvedView,
    ForgeEvent,
    ForgeRole,
    ForgeAuth,
} from "./dsl/types.js";

// Code Generators
export { generateApi } from "./codegen/api.js";
export { generateDb } from "./codegen/db.js";
export { generateUi } from "./codegen/ui.js";

// Runtime
export {
    IntentRouter,
    forgeExpressAdapter,
    ForgeIntentNotFoundError,
} from "./runtime/router.js";
export type { IntentContext, IntentHandler } from "./runtime/router.js";

export {
    ForgeEventBus,
    forgeBus,
} from "./runtime/events.js";
export type { ForgeEventPayload, ForgeEventHandler } from "./runtime/events.js";

export {
    ForgeValidator,
} from "./runtime/validator.js";

export {
    ForgeContext,
    forgeContext,
    ForgeContextError,
} from "./runtime/context.js";

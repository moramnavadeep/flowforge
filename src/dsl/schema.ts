/**
 * FlowForge DSL Schema Parser
 *
 * Reads a `.forge.yaml` file and produces a fully normalized `ForgeGraph`
 * — the internal intermediate representation used by all code generators.
 *
 * This is the core innovation of FlowForge:
 *   YAML intent → ForgeGraph → (API routes, DB schema, React UI)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { z } from "zod";
import type {
    ForgeApp,
    ForgeField,
    ForgeScalar,
    ForgeGraph,
    ResolvedEntity,
    ResolvedRoute,
    ResolvedView,
    ForgeHttpMethod,
} from "./types.js";

// ─── Zod Schemas for YAML validation ────────────────────────────────────────

const ForgeScalarSchema = z.enum([
    "string", "number", "boolean", "date", "datetime",
    "email", "url", "uuid", "text", "json",
]);

const ForgeFieldSchema = z.union([
    ForgeScalarSchema,
    z.object({
        type: ForgeScalarSchema,
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
        label: z.string().optional(),
        default: z.string().optional(),
        maxLength: z.number().optional(),
        display: z.boolean().optional(),
        ref: z.string().optional(),
    }),
]);

const ForgeEntitySchema = z.object({
    plural: z.string().optional(),
    fields: z.record(z.string(), ForgeFieldSchema),
    timestamps: z.boolean().optional(),
    softDelete: z.boolean().optional(),
});

const ForgeRouteActionSchema = z.union([
    z.string(),
    z.object({
        intent: z.string(),
        roles: z.array(z.string()).optional(),
        middleware: z.array(z.string()).optional(),
    }),
]);

const ForgeRouteDefSchema = z.object({
    get: ForgeRouteActionSchema.optional(),
    post: ForgeRouteActionSchema.optional(),
    put: ForgeRouteActionSchema.optional(),
    patch: ForgeRouteActionSchema.optional(),
    delete: ForgeRouteActionSchema.optional(),
});

const ForgeViewLayoutSchema = z.object({
    component: z.enum(["table", "form", "detail", "gallery", "chart", "kanban", "calendar"]),
    entity: z.string(),
    columns: z.array(z.union([
        z.string(),
        z.object({ field: z.string(), label: z.string().optional(), sortable: z.boolean().optional(), filterable: z.boolean().optional() }),
    ])).optional(),
    actions: z.array(z.enum(["create", "edit", "delete", "view"])).optional(),
});

const ForgeViewSchema = z.object({
    title: z.string().optional(),
    layout: z.array(ForgeViewLayoutSchema).optional(),
    table: z.string().optional(),
    form: z.string().optional(),
    roles: z.array(z.string()).optional(),
});

const ForgeEventSchema = z.object({
    on: z.string(),
    do: z.string(),
    params: z.record(z.string(), z.string()).optional(),
});

const ForgeRoleSchema = z.object({
    description: z.string().optional(),
    permissions: z.record(z.string(), z.array(z.enum(["list", "create", "get", "update", "delete", "*"]))).optional(),
});

const ForgeAuthSchema = z.object({
    strategy: z.enum(["jwt", "session", "apikey", "none"]),
    userEntity: z.string().optional(),
    identifierField: z.string().optional(),
    passwordField: z.string().optional(),
});

const ForgeAppSchema = z.object({
    app: z.string(),
    description: z.string().optional(),
    version: z.string().optional(),
    auth: ForgeAuthSchema.optional(),
    entities: z.record(z.string(), ForgeEntitySchema).optional(),
    routes: z.record(z.string(), ForgeRouteDefSchema).optional(),
    ui: z.record(z.string(), ForgeViewSchema).optional(),
    events: z.array(ForgeEventSchema).optional(),
    roles: z.record(z.string(), ForgeRoleSchema).optional(),
});

// ─── Intent Parser ───────────────────────────────────────────────────────────

const INTENT_ACTIONS = ["list", "create", "get", "update", "delete"] as const;
type IntentAction = (typeof INTENT_ACTIONS)[number];

function parseIntent(
    intent: string,
    entityNames: string[],
): { action: ResolvedRoute["action"]; entity?: string } {
    const lower = intent.toLowerCase().trim();
    for (const action of INTENT_ACTIONS) {
        if (lower.startsWith(action + " ")) {
            const candidate = intent.slice(action.length + 1).trim();
            // Match singular or plural entity name
            const entity = entityNames.find(
                (e) =>
                    e.toLowerCase() === candidate.toLowerCase() ||
                    (candidate.toLowerCase().endsWith("s") &&
                        e.toLowerCase() === candidate.toLowerCase().slice(0, -1)),
            );
            return { action, entity };
        }
    }
    return { action: "custom" };
}

// ─── Field normalizer ────────────────────────────────────────────────────────

function normalizeField(raw: ForgeScalar | Partial<ForgeField>): ForgeField {
    if (typeof raw === "string") {
        return { type: raw as ForgeScalar, required: true };
    }
    return {
        type: raw.type ?? "string",
        required: raw.required ?? true,
        unique: raw.unique,
        label: raw.label,
        default: raw.default,
        maxLength: raw.maxLength,
        display: raw.display,
        ref: raw.ref,
    };
}

// ─── Entity resolver ─────────────────────────────────────────────────────────

function resolveEntities(
    raw: NonNullable<ForgeApp["entities"]>,
): Record<string, ResolvedEntity> {
    const resolved: Record<string, ResolvedEntity> = {};
    for (const [name, entity] of Object.entries(raw)) {
        const fields: Record<string, ForgeField> = {};
        for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
            fields[fieldName] = normalizeField(fieldDef as ForgeScalar | Partial<ForgeField>);
        }
        resolved[name] = {
            name,
            plural: entity.plural ?? `${name}s`,
            fields,
            timestamps: entity.timestamps ?? true,
            softDelete: entity.softDelete ?? false,
        };
    }
    return resolved;
}

// ─── Route resolver ──────────────────────────────────────────────────────────

function resolveRoutes(
    raw: NonNullable<ForgeApp["routes"]>,
    entityNames: string[],
): ResolvedRoute[] {
    const routes: ResolvedRoute[] = [];
    for (const [path, routeDef] of Object.entries(raw)) {
        const methods: ForgeHttpMethod[] = ["get", "post", "put", "patch", "delete"];
        for (const method of methods) {
            const action = routeDef[method];
            if (!action) continue;

            const intentStr = typeof action === "string" ? action : action.intent;
            const roles = typeof action === "object" ? action.roles : undefined;
            const middleware = typeof action === "object" ? action.middleware : undefined;

            const { action: actionKind, entity } = parseIntent(intentStr, entityNames);

            routes.push({
                path,
                method,
                intent: intentStr,
                action: actionKind,
                entity,
                roles,
                middleware,
            });
        }
    }
    return routes;
}

// ─── View resolver ───────────────────────────────────────────────────────────

function resolveViews(raw: NonNullable<ForgeApp["ui"]>): ResolvedView[] {
    return Object.entries(raw).map(([path, view]) => {
        // Normalize shorthand `table:` and `form:` to full layout entries
        const layout = view.layout ? [...view.layout] : [];
        if (view.table && !layout.length) {
            layout.push({ component: "table", entity: view.table, actions: ["create", "edit", "delete"] });
        }
        if (view.form && !layout.length) {
            layout.push({ component: "form", entity: view.form });
        }
        return {
            path,
            title: view.title ?? path.replace(/^\//, "").replace(/-/g, " "),
            layout,
            roles: view.roles,
        };
    });
}

// ─── Main Parse Function ─────────────────────────────────────────────────────

/**
 * Parse a `.forge.yaml` file path and return a fully normalized `ForgeGraph`.
 * Throws a descriptive error if the spec is invalid.
 */
export function parseForgeSpec(filePath: string): ForgeGraph {
    const absolutePath = resolve(filePath);
    const raw = readFileSync(absolutePath, "utf-8");

    let parsed: unknown;
    try {
        parsed = yaml.load(raw);
    } catch (err) {
        throw new Error(`FlowForge: Failed to parse YAML in "${filePath}":\n${(err as Error).message}`);
    }

    const result = ForgeAppSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
            .join("\n");
        throw new Error(`FlowForge: Invalid spec "${filePath}":\n${issues}`);
    }

    const app = result.data as ForgeApp;

    const entities = resolveEntities(app.entities ?? {});
    const entityNames = Object.keys(entities);

    return {
        app: app.app,
        description: app.description ?? "",
        version: app.version ?? "0.0.1",
        auth: app.auth ?? { strategy: "none" },
        entities,
        routes: resolveRoutes(app.routes ?? {}, entityNames),
        views: resolveViews(app.ui ?? {}),
        events: app.events ?? [],
        roles: app.roles ?? {},
    };
}

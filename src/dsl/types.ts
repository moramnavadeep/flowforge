/**
 * FlowForge DSL Type Definitions
 *
 * These types describe the shape of a `.forge.yaml` intent specification.
 * A ForgeApp is the root — it's the single source of truth from which
 * FlowForge generates your entire backend, database, and frontend.
 */

// ─── Primitive scalar types supported in the DSL ───────────────────────────

export type ForgeScalar =
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "datetime"
    | "email"
    | "url"
    | "uuid"
    | "text"
    | "json";

// ─── Field: a single property on an entity ─────────────────────────────────

export interface ForgeField {
    /** The scalar type of this field */
    type: ForgeScalar;
    /** Whether this field is required. Defaults to true */
    required?: boolean;
    /** Whether this field must be unique across records */
    unique?: boolean;
    /** A human-readable label for UI generation */
    label?: string;
    /** Default value (serialized as string) */
    default?: string;
    /** For string types: max length constraint */
    maxLength?: number;
    /** Marks this field as the display name for the entity */
    display?: boolean;
    /** If set, this field references another entity (foreign key) */
    ref?: string;
}

// ─── Entity: a data model (maps to a DB table + API resource) ──────────────

export interface ForgeEntity {
    /** Human-readable plural name used in the UI */
    plural?: string;
    /** Map of field name → field definition */
    fields: Record<string, ForgeField | ForgeScalar>;
    /** Timestamps (createdAt, updatedAt) — defaults to true */
    timestamps?: boolean;
    /** Soft delete instead of hard delete — defaults to false */
    softDelete?: boolean;
}

// ─── Action: a single API endpoint intent ──────────────────────────────────

export type ForgeHttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type ForgeBuiltinAction =
    | `list ${string}`
    | `create ${string}`
    | `get ${string}`
    | `update ${string}`
    | `delete ${string}`;

export interface ForgeRouteAction {
    /** Intent string — e.g. "list Students", "create Student" */
    intent: string;
    /** Optional: restrict to specific roles */
    roles?: string[];
    /** Optional: middleware tags (e.g. "auth", "rateLimit") */
    middleware?: string[];
}

export type ForgeRouteDef = {
    [method in ForgeHttpMethod]?: string | ForgeRouteAction;
};

// ─── View: a UI page intent ─────────────────────────────────────────────────

export type ForgeViewComponent =
    | "table"
    | "form"
    | "detail"
    | "gallery"
    | "chart"
    | "kanban"
    | "calendar";

export interface ForgeViewColumn {
    field: string;
    label?: string;
    sortable?: boolean;
    filterable?: boolean;
}

export interface ForgeView {
    /** Page title */
    title?: string;
    /** Layout components on this view */
    layout?: {
        component: ForgeViewComponent;
        entity: string;
        columns?: (string | ForgeViewColumn)[];
        actions?: ("create" | "edit" | "delete" | "view")[];
    }[];
    /** Shorthand: table of entity */
    table?: string;
    /** Shorthand: form for entity */
    form?: string;
    /** Required roles to view this page */
    roles?: string[];
}

// ─── Role: an access control role ──────────────────────────────────────────

export interface ForgeRole {
    /** Human-readable description */
    description?: string;
    /** Permissions: entityName → array of allowed actions */
    permissions?: Record<string, ("list" | "create" | "get" | "update" | "delete" | "*")[]>;
}

// ─── Event: a reactive trigger ─────────────────────────────────────────────

export interface ForgeEvent {
    /** When: "entity.action" e.g. "Student.created" */
    on: string;
    /** What to do: built-in effect intent */
    do: string;
    /** Optional parameters for the effect */
    params?: Record<string, string>;
}

// ─── Auth: authentication configuration ────────────────────────────────────

export interface ForgeAuth {
    /** Auth strategy */
    strategy: "jwt" | "session" | "apikey" | "none";
    /** Entity used as the user model */
    userEntity?: string;
    /** The field used as the login identifier */
    identifierField?: string;
    /** The field used as the password */
    passwordField?: string;
}

// ─── The root application intent ───────────────────────────────────────────

export interface ForgeApp {
    /** Application name */
    app: string;
    /** Optional human-readable description */
    description?: string;
    /** Application version */
    version?: string;

    /** Authentication configuration */
    auth?: ForgeAuth;

    /** Data entities (models) */
    entities?: Record<string, ForgeEntity>;

    /** API routes (intent-mapped HTTP endpoints) */
    routes?: Record<string, ForgeRouteDef>;

    /** UI views (page layouts) */
    ui?: Record<string, ForgeView>;

    /** Reactive event hooks */
    events?: ForgeEvent[];

    /** Role-based access control */
    roles?: Record<string, ForgeRole>;
}

// ─── Parsed & normalized internal graph ────────────────────────────────────

/** A fully resolved entity with all inline scalars expanded to ForgeField */
export interface ResolvedEntity extends Omit<ForgeEntity, "fields"> {
    name: string;
    plural: string;
    fields: Record<string, ForgeField>;
    timestamps: boolean;
    softDelete: boolean;
}

/** A fully resolved route with entity + action extracted from intent string */
export interface ResolvedRoute {
    path: string;
    method: ForgeHttpMethod;
    intent: string;
    /** Parsed: action kind e.g. "list" | "create" | "get" | "update" | "delete" | "custom" */
    action: "list" | "create" | "get" | "update" | "delete" | "custom";
    /** Parsed: target entity name, if intent maps to a known entity */
    entity?: string;
    roles?: string[];
    middleware?: string[];
}

/** A fully resolved view with layout always normalized to array form */
export interface ResolvedView {
    path: string;
    title: string;
    layout: NonNullable<ForgeView["layout"]>;
    roles?: string[];
}

/** The fully normalized application graph — the internal IR for code generation */
export interface ForgeGraph {
    app: string;
    description: string;
    version: string;
    auth: ForgeAuth;
    entities: Record<string, ResolvedEntity>;
    routes: ResolvedRoute[];
    views: ResolvedView[];
    events: ForgeEvent[];
    roles: Record<string, ForgeRole>;
}

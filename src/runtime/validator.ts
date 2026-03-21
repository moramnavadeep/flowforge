/**
 * FlowForge Schema Validator
 *
 * Generates Zod validators from a ForgeGraph at runtime.
 * Used by the Express adapter for request body validation —
 * without needing a separate OpenAPI codegen step.
 *
 * Usage (automatic via Express adapter):
 *   const validator = new ForgeValidator(graph);
 *   const schema = validator.getInsertSchema("Student");
 *   const parsed = schema.parse(req.body);
 *
 * Or use the Express middleware directly:
 *   router.post("/students", validator.middleware("Student"), handler);
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import type { ForgeGraph, ResolvedEntity, ForgeField, ForgeScalar } from "../dsl/types.js";

// ─── Scalar → Zod mapping ─────────────────────────────────────────────────────

function scalarToZod(scalar: ForgeScalar, field: ForgeField): z.ZodTypeAny {
    let schema: z.ZodTypeAny;
    switch (scalar) {
        case "string":
            schema = field.maxLength ? z.string().max(field.maxLength) : z.string();
            break;
        case "text":
            schema = z.string();
            break;
        case "number":
            schema = z.number();
            break;
        case "boolean":
            schema = z.boolean();
            break;
        case "date":
        case "datetime":
            schema = z.coerce.date();
            break;
        case "email":
            schema = z.string().email();
            break;
        case "url":
            schema = z.string().url();
            break;
        case "uuid":
            schema = z.string().uuid();
            break;
        case "json":
            schema = z.unknown();
            break;
        default:
            schema = z.string();
    }

    if (!field.required) schema = schema.optional();
    return schema;
}

// ─── ForgeValidator ───────────────────────────────────────────────────────────

export class ForgeValidator {
    private insertSchemas = new Map<string, z.ZodObject<z.ZodRawShape>>();
    private updateSchemas = new Map<string, z.ZodObject<z.ZodRawShape>>();

    constructor(graph: ForgeGraph) {
        for (const [name, entity] of Object.entries(graph.entities)) {
            const shape: z.ZodRawShape = {};
            for (const [fieldName, field] of Object.entries(entity.fields)) {
                // Skip auto-managed fields from user input
                if (["id", "createdAt", "updatedAt", "deletedAt"].includes(fieldName)) continue;
                shape[fieldName] = scalarToZod(field.type, field);
            }
            const insertSchema = z.object(shape);
            this.insertSchemas.set(name, insertSchema);
            this.updateSchemas.set(name, insertSchema.partial());
        }
    }

    /**
     * Get the insert (create) Zod schema for an entity.
     * Throws if the entity doesn't exist in the graph.
     */
    getInsertSchema(entityName: string): z.ZodObject<z.ZodRawShape> {
        const schema = this.insertSchemas.get(entityName);
        if (!schema) throw new Error(`FlowForge Validator: Unknown entity "${entityName}"`);
        return schema;
    }

    /**
     * Get the update (partial patch) Zod schema for an entity.
     */
    getUpdateSchema(entityName: string): z.ZodObject<z.ZodRawShape> {
        const schema = this.updateSchemas.get(entityName);
        if (!schema) throw new Error(`FlowForge Validator: Unknown entity "${entityName}"`);
        return schema;
    }

    /**
     * Express middleware: validates `req.body` against the insert schema.
     * Attaches parsed body to `req.body` on success.
     * Sends a 422 with Zod error details on failure.
     *
     * @example
     *   router.post("/students", validator.middleware("Student"), createHandler);
     */
    middleware(
        entityName: string,
        mode: "insert" | "update" = "insert",
    ): (req: Request, res: Response, next: NextFunction) => void {
        const schema = mode === "insert"
            ? this.getInsertSchema(entityName)
            : this.getUpdateSchema(entityName);

        return (req, res, next) => {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                res.status(422).json({
                    error: "Validation failed",
                    issues: result.error.issues.map((i) => ({
                        field: i.path.join("."),
                        message: i.message,
                    })),
                });
                return;
            }
            req.body = result.data;
            next();
        };
    }

    /**
     * Validate a payload directly (non-Express usage).
     * Returns parsed data or throws a ZodError.
     */
    validate<T = unknown>(entityName: string, data: unknown, mode: "insert" | "update" = "insert"): T {
        const schema = mode === "insert"
            ? this.getInsertSchema(entityName)
            : this.getUpdateSchema(entityName);
        return schema.parse(data) as T;
    }

    /**
     * List all entity names that have validators registered.
     */
    listEntities(): string[] {
        return [...this.insertSchemas.keys()];
    }
}

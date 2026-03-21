/**
 * FlowForge UI Code Generator
 *
 * Converts a ForgeGraph's views into React component source code.
 * Each view generates:
 *  - A React Query hook (from the intent-mapped API client)
 *  - A fully typed data table or form component
 *  - Route registration for React Router v6
 */

import type { ForgeGraph, ResolvedView, ResolvedEntity } from "../dsl/types.js";

// ─── Route page generator ─────────────────────────────────────────────────────

function generateTableComponent(view: ResolvedView, entity: ResolvedEntity | undefined): string {
    const entityName = entity?.name ?? "Item";
    const plural = entity?.plural ?? `${entityName}s`;
    const columns = entity
        ? Object.entries(entity.fields)
            .filter(([, f]) => typeof f === "object" && f.display !== false)
            .slice(0, 5)
            .map(([name]) => name)
        : ["id", "name"];

    const colDefs = columns
        .map(
            (c) =>
                `  { accessorKey: "${c}", header: "${c.charAt(0).toUpperCase() + c.slice(1)}", },`,
        )
        .join("\n");

    return `
// ─── ${view.title} — Table View ────────────────────────────────────────────
export const ${entityName}TableColumns: ColumnDef<${entityName}>[] = [
${colDefs}
  {
    id: "actions",
    cell: ({ row }) => <RowActions id={row.original.id} />,
  },
];

export function ${entityName}TablePage() {
  const { data, isLoading } = useList${plural}();

  if (isLoading) return <LoadingSpinner />;

  return (
    <PageLayout title="${view.title}">
      <ForgeTable
        columns={${entityName}TableColumns}
        data={data?.data ?? []}
        createHref="${view.path}/new"
      />
    </PageLayout>
  );
}
`;
}

function generateFormComponent(view: ResolvedView, entity: ResolvedEntity | undefined): string {
    const entityName = entity?.name ?? "Item";
    const fields = entity
        ? Object.entries(entity.fields).map(([name, f]) => ({
            name,
            type: typeof f === "string" ? f : f.type,
            label: typeof f === "object" && f.label ? f.label : name,
            required: typeof f === "object" ? (f.required ?? true) : true,
        }))
        : [{ name: "name", type: "string", label: "Name", required: true }];

    const fieldInputs = fields
        .map(
            (f) => `
      <ForgeField
        name="${f.name}"
        label="${f.label}"
        type="${f.type}"
        ${f.required ? "required" : ""}
      />`,
        )
        .join("");

    return `
// ─── ${view.title} — Form View ─────────────────────────────────────────────
export function ${entityName}FormPage() {
  const navigate = useNavigate();
  const create = useCreate${entityName}();

  const onSubmit = async (data: New${entityName}) => {
    await create.mutateAsync(data);
    navigate("/${entityName.toLowerCase()}s");
  };

  return (
    <PageLayout title="${view.title}">
      <ForgeForm<New${entityName}> onSubmit={onSubmit} isLoading={create.isPending}>
${fieldInputs}
      </ForgeForm>
    </PageLayout>
  );
}
`;
}

// ─── Router file generator ────────────────────────────────────────────────────

function generateAppRouter(graph: ForgeGraph): string {
    const routeImports = [...new Set(
        graph.views.flatMap((v) => {
            const names: string[] = [];
            for (const l of v.layout) {
                const en = l.entity;
                if (l.component === "table") names.push(`${en}TablePage`);
                if (l.component === "form") names.push(`${en}FormPage`);
            }
            return names;
        }),
    )];

    return `
// ─── FlowForge App Router ─────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT
import { Routes, Route } from "react-router-dom";
import { ${routeImports.join(", ")} } from "./pages/index.js";
${graph.auth.strategy !== "none" ? 'import { ProtectedRoute } from "./components/ProtectedRoute.js";' : ""}

export function AppRouter() {
  return (
    <Routes>
${graph.views
            .map((v) => {
                const component = v.layout[0];
                if (!component) return "";
                const en = component.entity;
                const pageName =
                    component.component === "table"
                        ? `${en}TablePage`
                        : component.component === "form"
                            ? `${en}FormPage`
                            : `${en}Page`;

                if (v.roles?.length) {
                    return `      <Route path="${v.path}" element={<ProtectedRoute roles={[${v.roles.map((r) => `"${r}"`).join(", ")}]}><${pageName} /></ProtectedRoute>} />`;
                }
                return `      <Route path="${v.path}" element={<${pageName} />} />`;
            })
            .filter(Boolean)
            .join("\n")}
    </Routes>
  );
}
`;
}

// ─── Navigation generator ─────────────────────────────────────────────────────

function generateNavigation(graph: ForgeGraph): string {
    const navItems = graph.views.map((v) => `  { path: "${v.path}", label: "${v.title}" }`).join(",\n");
    return `
// AUTO-GENERATED navigation manifest
export const forgeNavItems = [
${navItems},
];
`;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Generate React component source files from a ForgeGraph.
 * Returns a map of filename → source code strings.
 */
export function generateUi(graph: ForgeGraph): Map<string, string> {
    const files = new Map<string, string>();

    const header = `/**
 * AUTO-GENERATED by FlowForge — DO NOT EDIT MANUALLY
 * App: ${graph.app} v${graph.version}
 * Generated at: ${new Date().toISOString()}
 */

/* eslint-disable */
// @ts-nocheck — generated file

import { type ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";
import {
  PageLayout, ForgeTable, ForgeForm, ForgeField, LoadingSpinner, RowActions,
} from "../components/index.js";
import {
  type ${Object.keys(graph.entities).join(", ")},
  type ${Object.keys(graph.entities).map((e) => `New${e}`).join(", ")},
} from "@workspace/api-zod";
import {
  ${graph.views
            .flatMap((v) => v.layout.map((l) => {
                const en = l.entity;
                return l.component === "table" ? `useList${graph.entities[en]?.plural ?? en + "s"}` : `useCreate${en}`;
            }))
            .filter(Boolean)
            .join(", ")
        },
} from "@workspace/api-client-react";
`;

    // Generate page components
    const pageComponents: string[] = [header];
    for (const view of graph.views) {
        for (const layout of view.layout) {
            const entity = graph.entities[layout.entity];
            if (layout.component === "table") {
                pageComponents.push(generateTableComponent(view, entity));
            } else if (layout.component === "form") {
                pageComponents.push(generateFormComponent(view, entity));
            }
        }
    }
    files.set("pages/index.tsx", pageComponents.join("\n"));

    // App router
    files.set("AppRouter.tsx", `// AUTO-GENERATED by FlowForge\n${generateAppRouter(graph)}`);

    // Navigation manifest
    files.set("navigation.ts", generateNavigation(graph));

    return files;
}

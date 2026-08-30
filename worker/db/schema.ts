export * from "../auth/schema";
// Legacy services use the plural table name; this is the same Better Auth table.
export { user as users } from "../auth/schema";
export * from "./core/columns";
export * from "./core/enums";
export * from "./core/notifications";
export * from "./core/relations";
export * from "./core/user-integrations";
export * from "./core/vaults";
export * from "./core/resources";

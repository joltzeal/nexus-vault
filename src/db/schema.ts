import * as authSchema from "./auth-schema";
import * as enums from "./domain/enums";
import * as notifications from "./domain/notifications";
import * as relations from "./domain/relations";
import * as resources from "./domain/resources";
import * as vaults from "./domain/vaults";

export const schema = {
	...authSchema,
	...enums,
	...vaults,
	...resources,
	...notifications,
	...relations,
} as const;

export * from "./auth-schema";
export * from "./domain/enums";
export * from "./domain/vaults";
export * from "./domain/resources";
export * from "./domain/notifications";
export * from "./domain/relations";

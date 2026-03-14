import type { createAPIClient } from "@/app/api-client";
import type {
  components as defaultComponents,
  operations as defaultOperations,
} from "@/api-types/storeApiTypes";

export type operations = defaultOperations;

export type Schemas = defaultComponents["schemas"];

export type ApiClient = ReturnType<typeof createAPIClient<operations>>;

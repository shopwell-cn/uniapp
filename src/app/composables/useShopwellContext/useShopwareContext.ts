import { inject } from "vue";
import ContextError from "@/app/composables/helpers/ContextError";
import type {ApiClient} from "@/app/composables/types/api-types";

export type ShopwellContext = {
  /**
   * Shopwell API client
   */
  apiClient: ApiClient;
};

/**
 * @public
 * @category Context & Language
 */
export function useShopwellContext(): ShopwellContext {
  const shopwellContext = inject<ShopwellContext | null>("shopwell", null);

  const apiClient = inject<ApiClient>("apiClient");

  if (!shopwellContext || !apiClient) {
    console.error("[Error][Shopwell] API Client is not provided.");
    throw new ContextError("Shopwell or apiClient");
  }

  return {
    apiClient,
  };
}

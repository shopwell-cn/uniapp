import { computed } from "vue";
import type { ComputedRef, Ref } from "vue";
import ContextError from "../helpers/ContextError";
import {useContext} from "@/app/composables/useContext/useContext";
import type {Schemas} from "@/app/composables/types/api-types";

export type UseCategoryReturn = {
  /**
   * Current category entity
   */
  category: ComputedRef<Schemas["Category"]>;
};

/**
 * Composable to get the category from current CMS context
 *
 * @category Product
 * @public
 */
export function useCategory(
  category?: Ref<Schemas["Category"]>,
): UseCategoryReturn {
  const _category = useContext("category", { context: category });
  if (!_category.value) {
    throw new ContextError("Category");
  }

  return {
    category: computed(() => _category.value),
  };
}

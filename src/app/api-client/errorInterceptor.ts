import type { ApiError } from "@/app/api-client/ApiError";
import { ApiClientError } from "@/app/api-client/ApiError";
import type { UniResponse } from "@/app/api-client/uniRequest";

type ErrorResponse = { errors: Array<ApiError> };

export function errorInterceptor(
  response: UniResponse<unknown>,
): asserts response is UniResponse<ErrorResponse> {
  throw new ApiClientError(response as UniResponse<ErrorResponse>);
}

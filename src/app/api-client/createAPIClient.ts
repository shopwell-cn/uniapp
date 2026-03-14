import defu from "defu";
import { createHooks } from "hookable";
import type { operations } from "../../../api-types/storeApiTypes";
import { type ClientHeaders, createHeaders } from "@/app/api-client/defaultHeaders";
import { createPathWithParams } from "@/app/api-client/transformPathToQuery";
import { errorInterceptor } from "@/app/api-client/errorInterceptor";
import type {
  GlobalRequestOptions,
  InvokeParameters,
  RequestReturnType,
  SimpleUnionOmit,
  SimpleUnionPick,
  UniRequestMethod,
} from "./types";
import {
  type UniRequestAdapter,
  type UniRequestContext,
  type UniResponse,
  requestWithUni,
  resolveUniRequest,
} from "./uniRequest";
import {
  buildUrl,
  getHeaderValue,
  normalizeHeaderRecord,
  removeHeader,
} from "./utils";

export type ApiClientHooks = {
  onContextChanged: (newContextToken: string) => void;
  onResponseError: (response: UniResponse<unknown>) => void;
  onSuccessResponse: <T>(response: UniResponse<T>) => void;
  onDefaultHeaderChanged: <T>(headerName: string, value?: T) => void;
  onRequest: (context: UniRequestContext) => void;
};

export function createAPIClient<
  // biome-ignore lint/suspicious/noExplicitAny: we allow for broader types to be used
  OPERATIONS extends Record<string, any> = operations,
  PATHS extends string | number | symbol = keyof OPERATIONS,
>(clientConfig: {
  baseURL?: string;
  accessToken?: string;
  contextToken?: string;
  defaultHeaders?: ClientHeaders;
  fetchOptions?: GlobalRequestOptions;
  request?: UniRequestAdapter;
}) {
  const apiClientHooks = createHooks<ApiClientHooks>();

  const defaultHeaders = createHeaders(
    {
      "sw-access-key": clientConfig.accessToken,
      accept: "application/json",
      "sw-context-token": clientConfig.contextToken,
      ...clientConfig.defaultHeaders,
    },
    (key, value) => {
      apiClientHooks.callHook("onDefaultHeaderChanged", key, value);
      if (key === "sw-context-token" && value) {
        apiClientHooks.callHook("onContextChanged", value);
      }
    },
  );

  let currentBaseURL = clientConfig.baseURL;
  let currentAccessToken = clientConfig.accessToken;

  const request = resolveUniRequest(clientConfig.request);

  async function invoke<
    INVOKE_PATH extends PATHS,
    OPERATION_NAME extends string = INVOKE_PATH extends `${infer R}`
      ? R extends string
        ? R
        : never
      : never,
    CURRENT_OPERATION extends
      OPERATIONS[OPERATION_NAME] = OPERATION_NAME extends keyof OPERATIONS
      ? OPERATIONS[OPERATION_NAME]
      : never,
  >(
    pathParam: OPERATION_NAME extends keyof OPERATIONS ? OPERATION_NAME : never,
    ...invokeParams: SimpleUnionOmit<
      CURRENT_OPERATION,
      "response" | "responseCode"
    > extends
      | {
          body: unknown;
        }
      | {
          query: unknown;
        }
      | {
          header: unknown;
        }
      | {
          pathParams: unknown;
        }
      ? [InvokeParameters<CURRENT_OPERATION>]
      : [InvokeParameters<CURRENT_OPERATION>?]
  ): Promise<RequestReturnType<CURRENT_OPERATION>> {
    const [, methodRaw, requestPath] = pathParam.split(" ") as [
      string,
      string,
      string,
    ];

    const currentParams =
      invokeParams[0] || ({} as InvokeParameters<CURRENT_OPERATION>);

    const requestPathWithParams = createPathWithParams(
      requestPath,
      currentParams.pathParams,
    );

    const mergedHeaders = normalizeHeaderRecord(
      defu(currentParams.headers, defaultHeaders) as Record<
        string,
        string | string[] | undefined
      >,
    );

    const contentType = getHeaderValue(mergedHeaders, "content-type");
    if (
      contentType?.includes("multipart/form-data") &&
      typeof window !== "undefined"
    ) {
      removeHeader(mergedHeaders, "content-type");
    }

    const method = methodRaw.toUpperCase() as UniRequestMethod;

    const context: UniRequestContext = {
      url: buildUrl(currentBaseURL, requestPathWithParams, currentParams.query),
      method,
      headers: mergedHeaders,
      body: currentParams.body,
      query: currentParams.query,
      timeout:
        currentParams.fetchOptions?.timeout ?? clientConfig.fetchOptions?.timeout,
    };
    apiClientHooks.callHook("onRequest", context);

    const response = await requestWithUni<
      SimpleUnionPick<CURRENT_OPERATION, "response">
    >({
      request,
      baseURL: currentBaseURL,
      path: requestPathWithParams,
      method,
      headers: mergedHeaders,
      query: currentParams.query,
      body: currentParams.body,
      options: {
        ...clientConfig.fetchOptions,
        ...currentParams.fetchOptions,
      },
    });

    apiClientHooks.callHook("onSuccessResponse", response);

    const newContextToken = getHeaderValue(response.headers, "sw-context-token");
    if (
      newContextToken &&
      defaultHeaders["sw-context-token"] !== newContextToken
    ) {
      defaultHeaders["sw-context-token"] = newContextToken;
    }

    if (!response.ok) {
      apiClientHooks.callHook("onResponseError", response);
      errorInterceptor(response);
    }

    return {
      data: response.data,
      status: response.status,
    } as RequestReturnType<CURRENT_OPERATION>;
  }

  return {
    invoke,
    /**
     * Default headers used in every client request (if not overridden in specific request).
     */
    defaultHeaders,
    hook: apiClientHooks.hook,
    /**
     * Update the base configuration for API client
     */
    updateBaseConfig: (config: { baseURL?: string; accessToken?: string }) => {
      if (config.baseURL !== undefined && config.baseURL !== currentBaseURL) {
        currentBaseURL = config.baseURL;
      }

      if (
        config.accessToken !== undefined &&
        config.accessToken !== currentAccessToken
      ) {
        currentAccessToken = config.accessToken;
        defaultHeaders["sw-access-key"] = config.accessToken;
      }
    },
    /**
     * Get the current base configuration
     */
    getBaseConfig: () => ({
      baseURL: currentBaseURL,
      accessToken: currentAccessToken,
    }),
  };
}

import defu from "defu";
import { createHooks } from "hookable";
import type { operations } from "../../../api-types/adminApiTypes";
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
    type UniResponse,
    requestWithUni,
    resolveUniRequest,
} from "./uniRequest";
import { normalizeHeaderRecord } from "./utils";

/**
 * Session data entity for admin API client.
 */
export type AdminSessionData = {
    accessToken: string;
    refreshToken?: string;
    expirationTime: number;
};

type AuthResponse = {
    access_token?: string;
    refresh_token: string;
    expires_in: number;
};

function createAuthorizationHeader(token: string) {
    if (!token) return "";
    if (token.startsWith("Bearer ")) return token;
    return `Bearer ${token}`;
}

export type AdminApiClientHooks = {
    onAuthChange: (authData: AdminSessionData) => void;
    onResponseError: (response: UniResponse<unknown>) => void;
    onSuccessResponse: (response: UniResponse<unknown>) => void;
    onDefaultHeaderChanged: <T>(headerName: string, value?: T) => void;
};

export function createAdminAPIClient<
    // biome-ignore lint/suspicious/noExplicitAny: we allow for broader types to be used
    OPERATIONS extends Record<string, any> = operations,
    PATHS extends string | number | symbol = keyof OPERATIONS,
>(clientConfig: {
    baseURL?: string;
    /**
     * If you pass `credentials` object, it will be used to authenticate the client whenever session expires.
     * You don`t need to manually invoke `/token` endpoint first.
     */
    credentials?: OPERATIONS["token post /oauth/token"]["body"];
    sessionData?: AdminSessionData;
    defaultHeaders?: ClientHeaders;
    fetchOptions?: GlobalRequestOptions;
    request?: UniRequestAdapter;
}) {
    const isTokenBasedAuth =
        clientConfig.credentials?.grant_type === "client_credentials";

    const apiClientHooks = createHooks<AdminApiClientHooks>();

    const sessionData: AdminSessionData = {
        accessToken: clientConfig.sessionData?.accessToken || "",
        refreshToken: clientConfig.sessionData?.refreshToken || "",
        expirationTime: Number(clientConfig.sessionData?.expirationTime || 0),
    };

    const defaultHeaders = createHeaders(
        {
            Authorization: createAuthorizationHeader(sessionData.accessToken),
            Accept: "application/json",
        },
        (key, value) => {
            apiClientHooks.callHook("onDefaultHeaderChanged", key, value);
        },
    );

    const request = resolveUniRequest(clientConfig.request);

    function getSessionData() {
        return { ...sessionData };
    }

    function setSessionData(data: AdminSessionData): AdminSessionData {
        sessionData.accessToken = data.accessToken;
        sessionData.refreshToken = data.refreshToken || "";
        sessionData.expirationTime = data.expirationTime;

        return getSessionData();
    }

    function updateSessionData(responseData: AuthResponse) {
        if (responseData?.access_token) {
            defaultHeaders.Authorization = createAuthorizationHeader(
                responseData.access_token,
            );

            const dataCopy = setSessionData({
                accessToken: responseData.access_token,
                refreshToken: responseData.refresh_token,
                expirationTime: Date.now() + responseData.expires_in * 1000,
            });
            apiClientHooks.callHook("onAuthChange", dataCopy);
        }
    }

    function isAuthResponse(value: unknown): value is AuthResponse {
        if (!value || typeof value !== "object") return false;
        const record = value as Record<string, unknown>;
        return (
            typeof record.refresh_token === "string" &&
            typeof record.expires_in === "number"
        );
    }

    async function refreshSessionIfNeeded(requestPath: string) {
        const isExpired = sessionData.expirationTime <= Date.now();
        if (!isExpired || requestPath.includes("/oauth/token")) return;

        if (
            !clientConfig.credentials &&
            !isTokenBasedAuth &&
            !sessionData.refreshToken
        ) {
            console.warn(
                "[ApiClientWarning] No `credentials` or `sessionData` provided. Provide at least one of them to ensure authentication.",
            );
        }

        const body =
            clientConfig.credentials && !sessionData.refreshToken
                ? clientConfig.credentials
                : {
                    grant_type: "refresh_token",
                    client_id: "administration",
                    refresh_token: sessionData.refreshToken,
                };

        const refreshResponse = await requestWithUni<AuthResponse>({
            request,
            baseURL: clientConfig.baseURL,
            path: "/oauth/token",
            method: "POST",
            headers: normalizeHeaderRecord(defaultHeaders as Record<
                string,
                string | string[] | undefined
            >),
            body,
        });

        apiClientHooks.callHook("onSuccessResponse", refreshResponse);

        if (!refreshResponse.ok) {
            apiClientHooks.callHook("onResponseError", refreshResponse);
            errorInterceptor(refreshResponse);
        }

        updateSessionData(refreshResponse.data);
    }

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

        await refreshSessionIfNeeded(requestPathWithParams);

        const mergedHeaders = normalizeHeaderRecord(
            defu(currentParams.headers, defaultHeaders) as Record<
                string,
                string | string[] | undefined
            >,
        );

        const method = methodRaw.toUpperCase() as UniRequestMethod;

        const response = await requestWithUni<
            SimpleUnionPick<CURRENT_OPERATION, "response">
        >({
            request,
            baseURL: clientConfig.baseURL,
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

        if (
            requestPathWithParams.includes("/oauth/token") &&
            response.ok &&
            isAuthResponse(response.data)
        ) {
            updateSessionData(response.data);
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
         * Enables to change session data in runtime. Useful for testing purposes.
         * Setting session data with this method will **not** fire `onAuthChange` hook.
         */
        setSessionData,
        /**
         * Returns current session data. Useful for testing purposes, as in most cases you`ll want to use `onAuthChange` hook for that.
         */
        getSessionData,
        /**
         * Default headers used in every client request (if not overriden in specific request).
         */
        defaultHeaders,
        /**
         * Available hooks for the client.
         */
        hook: apiClientHooks.hook,
    };
}

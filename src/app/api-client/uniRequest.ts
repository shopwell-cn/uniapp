import type { UniRequestMethod, UniRequestOptions } from "@/app/api-client/types";
import { appendQuery, joinUrl, normalizeHeaderRecord } from "@/app/api-client/utils";

export type UniRequestOptionsCompat = Omit<UniNamespace.RequestOptions, "method"> & {
  method?: UniRequestMethod;
};

export type UniRequestAdapter = (
  options: UniRequestOptionsCompat,
) => UniRequestTask;

export type UniRequestTask = UniNamespace.RequestTask;

export type UniRequestSuccess = UniNamespace.RequestSuccessCallbackResult;
export type UniRequestError = UniNamespace.GeneralCallbackResult;

export type UniResponse<T> = {
  ok: boolean;
  status: number;
  statusText?: string;
  url: string;
  headers: Record<string, string>;
  data: T;
  _data: T;
  raw: UniRequestSuccess;
};

export type UniRequestContext = {
  url: string;
  method: UniRequestMethod;
  headers: Record<string, string>;
  body?: UniRequestOptionsCompat["data"];
  query?: Record<string, unknown>;
  timeout?: number;
};

type RequestConfig = {
  baseURL?: string;
  path: string;
  method: UniRequestMethod;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: UniRequestOptionsCompat["data"];
  request: UniRequestAdapter;
  options?: UniRequestOptions;
};

const defaultRetryStatusCodes = [408, 409, 425, 429, 500, 502, 503, 504];

export function resolveUniRequest(request?: UniRequestAdapter): UniRequestAdapter {
  if (request) return request;

  if (typeof uni !== "undefined" && uni?.request) {
    const uniRequest = uni.request as (
      options: UniNamespace.RequestOptions,
    ) => UniNamespace.RequestTask;

    return (options) => uniRequest(options as UniNamespace.RequestOptions);
  }

  throw new Error(
    "[ApiClientError] uni.request is not available. Provide a request adapter.",
  );
}

export async function requestWithUni<T>(config: RequestConfig): Promise<UniResponse<T>> {
  const requestOptions = config.options ?? {};
  const url = appendQuery(
    joinUrl(config.baseURL, config.path),
    config.query,
  );
  const headers = config.headers ?? {};

  const requestOnce = () =>
    rawRequest<T>({
      request: config.request,
      url,
      method: config.method,
      headers,
      body: config.body,
      timeout: requestOptions.timeout,
      signal: requestOptions.signal,
    });

  return requestWithRetry(requestOnce, requestOptions);
}

type RawRequestConfig = {
  request: UniRequestAdapter;
  url: string;
  method: UniRequestMethod;
  headers: Record<string, string>;
  body?: UniRequestOptionsCompat["data"];
  timeout?: number;
  signal?: AbortSignal;
};

function rawRequest<T>(config: RawRequestConfig): Promise<UniResponse<T>> {
  return new Promise((resolve, reject) => {
    if (config.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      task?.abort?.();
      cleanup();
      reject(createAbortError());
    };
    const cleanup = () => {
      if (!config.signal) return;
      config.signal.removeEventListener("abort", onAbort);
    };

    const task = config.request({
      url: config.url,
      method: config.method,
      data: config.body,
      header: config.headers,
      timeout: config.timeout,
      dataType: "json",
      success: (res: UniRequestSuccess) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(toUniResponse(res, config.url));
      },
      fail: (err: UniRequestError) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(createRequestError(err));
      },
    });

    if (config.signal) {
      config.signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function toUniResponse<T>(res: UniRequestSuccess, url: string): UniResponse<T> {
  const status = res.statusCode;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: undefined,
    url,
    headers: normalizeHeaderRecord(res.header),
    data: res.data as T,
    _data: res.data as T,
    raw: res,
  };
}

function createAbortError(): Error {
  const error = new Error("The request was aborted");
  error.name = "AbortError";
  return error;
}

function createRequestError(error: UniRequestError): Error {
  return new Error(error.errMsg || "Request failed");
}

function normalizeRetryCount(retry?: number | boolean): number {
  if (retry === true) return 1;
  if (retry === false || retry === undefined) return 0;
  if (Number.isFinite(retry)) return Math.max(0, Math.trunc(retry));
  return 0;
}

function getRetryDelay(
  retryDelay: UniRequestOptions["retryDelay"],
  attempt: number,
): number {
  if (typeof retryDelay === "function") return Math.max(0, retryDelay(attempt));
  if (typeof retryDelay === "number") return Math.max(0, retryDelay);
  return 0;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function requestWithRetry<T>(
  requestOnce: () => Promise<UniResponse<T>>,
  options: UniRequestOptions,
): Promise<UniResponse<T>> {
  const maxRetries = normalizeRetryCount(options.retry);
  const retryStatusCodes = options.retryStatusCodes ?? defaultRetryStatusCodes;
  let attempt = 0;

  while (true) {
    try {
      const response = await requestOnce();
      if (
        !response.ok &&
        attempt < maxRetries &&
        retryStatusCodes.includes(response.status)
      ) {
        attempt += 1;
        await delay(getRetryDelay(options.retryDelay, attempt), options.signal);
        continue;
      }
      return response;
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (attempt < maxRetries) {
        attempt += 1;
        await delay(getRetryDelay(options.retryDelay, attempt), options.signal);
        continue;
      }
      throw error;
    }
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

export type SimpleUnionOmit<T, K extends string | number | symbol> =
  T extends unknown ? Omit<T, K> : never;

export type SimpleUnionPick<T, K extends keyof T> = T extends unknown
  ? Pick<T, K>
  : never;

export type RenameByT<T, U> = {
  [K in keyof U as K extends keyof T
    ? T[K] extends string
      ? T[K]
      : never
    : K]: K extends keyof U ? U[K] : never;
};

export type RequestReturnType<
  CURRENT_OPERATION extends {
    response: unknown;
    responseCode: number;
  },
> = RenameByT<
  { response: "data"; responseCode: "status" },
  SimpleUnionPick<CURRENT_OPERATION, "response" | "responseCode">
>;

export type RequestParameters<CURRENT_OPERATION> = SimpleUnionOmit<
  CURRENT_OPERATION,
  "response" | "responseCode"
>;

export type UniRequestOptions = {
  timeout?: number;
  signal?: AbortSignal;
  retry?: number | boolean;
  retryDelay?: number | ((attempt: number) => number);
  retryStatusCodes?: number[];
};

export type GlobalRequestOptions = Pick<
  UniRequestOptions,
  "retry" | "retryDelay" | "retryStatusCodes" | "timeout"
>;

export type InvokeParameters<CURRENT_OPERATION> =
  RequestParameters<CURRENT_OPERATION> & {
    fetchOptions?: UniRequestOptions;
  };

export type UniRequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS"
  | "HEAD";

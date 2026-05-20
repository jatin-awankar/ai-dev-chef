const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"]);
const RETRYABLE_ERROR_NAMES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "RateLimitError",
  "InternalServerError"
]);

export class OpenAIServiceError extends Error {
  constructor(
    message,
    {
      code = "OPENAI_SERVICE_ERROR",
      status,
      retryable = false,
      requestId,
      details,
      cause
    } = {}
  ) {
    super(message, { cause });
    this.name = "OpenAIServiceError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.requestId = requestId;
    this.details = details;
  }
}

export class OpenAIConfigurationError extends OpenAIServiceError {
  constructor(message, options = {}) {
    super(message, { code: "OPENAI_CONFIGURATION_ERROR", retryable: false, ...options });
    this.name = "OpenAIConfigurationError";
  }
}

export class OpenAITimeoutError extends OpenAIServiceError {
  constructor(message, options = {}) {
    super(message, { code: "OPENAI_TIMEOUT_ERROR", retryable: true, ...options });
    this.name = "OpenAITimeoutError";
  }
}

export class OpenAIRequestError extends OpenAIServiceError {
  constructor(message, options = {}) {
    super(message, { code: "OPENAI_REQUEST_ERROR", ...options });
    this.name = "OpenAIRequestError";
  }
}

function parseErrorMessage(error) {
  if (error?.error?.message) {
    return error.error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "OpenAI request failed.";
}

function parseStatus(error) {
  if (typeof error?.status === "number") {
    return error.status;
  }

  if (typeof error?.response?.status === "number") {
    return error.response.status;
  }

  return undefined;
}

function parseRequestId(error) {
  return error?.request_id ?? error?._request_id;
}

function isRetryable(error, status) {
  if (error instanceof OpenAIServiceError) {
    return error.retryable;
  }

  if (getErrorCode(error) === "insufficient_quota") {
    return false;
  }

  if (typeof status === "number" && RETRYABLE_HTTP_STATUS_CODES.has(status)) {
    return true;
  }

  if (typeof error?.code === "string" && RETRYABLE_ERROR_CODES.has(error.code)) {
    return true;
  }

  if (typeof error?.name === "string" && RETRYABLE_ERROR_NAMES.has(error.name)) {
    return true;
  }

  return false;
}

export function normalizeOpenAIError(error, { fallbackMessage } = {}) {
  if (error instanceof OpenAIServiceError) {
    if (isAccountQuotaError(error)) {
      return createAccountQuotaError(error);
    }

    return error;
  }

  if (error?.name === "AbortError" || error?.code === "ABORT_ERR") {
    return new OpenAITimeoutError(fallbackMessage ?? "OpenAI request timed out.", { cause: error });
  }

  const status = parseStatus(error);
  const retryable = isRetryable(error, status);
  const message = fallbackMessage ?? parseErrorMessage(error);

  const normalized = new OpenAIRequestError(message, {
    status,
    retryable,
    requestId: parseRequestId(error),
    details: error?.error,
    cause: error,
  });

  if (isAccountQuotaError(normalized)) {
    return createAccountQuotaError(normalized);
  }

  return normalized;
}

const MODEL_LIMIT_ERROR_CODES = new Set([
  "context_length_exceeded",
  "string_above_max_length",
  "max_tokens_exceeded",
  "rate_limit_exceeded",
  "insufficient_quota",
  "model_not_found",
  "model_overloaded",
]);

const MODEL_LIMIT_MESSAGE_PATTERNS = [
  /context length/i,
  /maximum context/i,
  /too many tokens/i,
  /token limit/i,
  /max tokens/i,
  /request too large/i,
  /payload too large/i,
  /rate limit/i,
  /model.*not found/i,
  /does not exist/i,
  /overloaded/i,
];

function getErrorDetails(error) {
  return error?.details ?? error?.cause?.error ?? error?.error;
}

function getErrorCode(error) {
  const details = getErrorDetails(error);

  if (typeof details?.code === "string") {
    return details.code;
  }

  if (typeof details?.type === "string") {
    return details.type;
  }

  if (typeof error?.code === "string") {
    return error.code;
  }

  if (typeof error?.cause?.code === "string") {
    return error.cause.code;
  }

  return undefined;
}

const ACCOUNT_QUOTA_MESSAGE_PATTERNS = [
  /exceeded your current quota/i,
  /insufficient_quota/i,
  /check your plan and billing/i,
];

export function isAccountQuotaError(error) {
  const errorCode = getErrorCode(error);
  if (errorCode === "insufficient_quota") {
    return true;
  }

  const message = error?.message ?? parseErrorMessage(error?.cause ?? error);
  return ACCOUNT_QUOTA_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function createAccountQuotaError(error) {
  const requestId = error?.requestId ?? parseRequestId(error?.cause ?? error);
  const status = error?.status ?? parseStatus(error?.cause ?? error);

  return new OpenAIRequestError(
    "Your OpenAI account has no remaining quota. Add billing or credits at https://platform.openai.com/account/billing. Switching models will not help because this limit applies to your entire API key.",
    {
      status,
      retryable: false,
      requestId,
      details: getErrorDetails(error),
      cause: error,
    },
  );
}

export function isModelFallbackEligibleError(error) {
  if (!error || error instanceof OpenAIConfigurationError) {
    return false;
  }

  if (error instanceof OpenAITimeoutError) {
    return false;
  }

  if (isAccountQuotaError(error)) {
    return false;
  }

  const status = error.status ?? parseStatus(error.cause);

  if (status === 401 || status === 402 || status === 403) {
    return false;
  }

  if (status === 413 || status === 429 || status === 404 || status === 503) {
    const errorCode = getErrorCode(error);
    if (errorCode === "rate_limit_exceeded") {
      return true;
    }

    return errorCode !== "insufficient_quota";
  }

  const errorCode = getErrorCode(error);
  if (typeof errorCode === "string" && MODEL_LIMIT_ERROR_CODES.has(errorCode)) {
    return errorCode !== "insufficient_quota";
  }

  const message = error.message ?? "";
  return MODEL_LIMIT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isRetryableOpenAIError(error) {
  if (error instanceof OpenAIServiceError) {
    return error.retryable;
  }

  if (isAccountQuotaError(error)) {
    return false;
  }

  return isRetryable(error, parseStatus(error));
}

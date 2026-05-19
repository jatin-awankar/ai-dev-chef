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
    return error;
  }

  if (error?.name === "AbortError" || error?.code === "ABORT_ERR") {
    return new OpenAITimeoutError(fallbackMessage ?? "OpenAI request timed out.", { cause: error });
  }

  const status = parseStatus(error);
  const retryable = isRetryable(error, status);
  const message = fallbackMessage ?? parseErrorMessage(error);

  return new OpenAIRequestError(message, {
    status,
    retryable,
    requestId: parseRequestId(error),
    details: error?.error,
    cause: error
  });
}

export function isRetryableOpenAIError(error) {
  if (error instanceof OpenAIServiceError) {
    return error.retryable;
  }

  return isRetryable(error, parseStatus(error));
}

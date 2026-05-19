export class SEOReportError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "SEOReportError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, SEOReportError.prototype);
  }
}

export class RateLimitError extends SEOReportError {
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfterSeconds?: number;
  };

  constructor(
    message: string,
    rateLimit: {
      limit: number;
      remaining: number;
      resetAt: number;
      retryAfterSeconds?: number;
    }
  ) {
    super("rate_limit", message, 429);
    this.name = "RateLimitError";
    this.rateLimit = rateLimit;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class AuthenticationError extends SEOReportError {
  constructor(message = "Invalid or revoked API key.") {
    super("authentication_error", message, 401);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class ValidationError extends SEOReportError {
  constructor(message: string) {
    super("validation_error", message, 400);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class TimeoutError extends SEOReportError {
  constructor(message = "Report polling timed out.") {
    super("timeout", message, 408);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class ServerError extends SEOReportError {
  constructor(message = "Server error.", status = 500) {
    super("server_error", message, status);
    this.name = "ServerError";
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

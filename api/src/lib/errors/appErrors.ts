import { CustomAppError } from "./customAppError";
import { ErrorCodes } from "./errorCodes";

const mk = (status: number, c: { code: string; label: string }, key: string) => (message: string) =>
  new CustomAppError(message, status, c.code, c.label, key);

export const badRequest = mk(400, ErrorCodes.VALIDATION_FAILED, "validation_failed");
export const unauthorized = mk(401, ErrorCodes.UNAUTHORIZED_ACCESS, "unauthorized");
export const forbidden = mk(403, ErrorCodes.PERMISSION_DENIED, "forbidden");
export const conflict = mk(409, ErrorCodes.INVALID_STATE, "invalid_state");
export const staleEdit = mk(409, ErrorCodes.CONCURRENT_MODIFICATION, "stale_revision");
export const tooMany = mk(429, ErrorCodes.RATE_LIMIT_EXCEEDED, "rate_limited");
export const notFound = (what = "Record") => new CustomAppError(`${what} not found`, 404, ErrorCodes.RECORD_NOT_FOUND.code, ErrorCodes.RECORD_NOT_FOUND.label, "not_found");
/** Used by the public portal. Deliberately identical for unknown, revoked and expired links. */
export const linkInvalid = () => new CustomAppError("This link is not valid", 404, ErrorCodes.LINK_INVALID.code, ErrorCodes.LINK_INVALID.label, "link_invalid");
export const notActionable = mk(409, ErrorCodes.PROPOSAL_NOT_ACTIONABLE, "not_actionable");
export const readinessFailed = (message: string) => new CustomAppError(message, 422, ErrorCodes.READINESS_FAILED.code, ErrorCodes.READINESS_FAILED.label, "readiness_failed");

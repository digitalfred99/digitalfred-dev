import { NextResponse } from "next/server";
import { QueryFailedError } from "typeorm";
import { CustomAppError } from "./customAppError";
import { ErrorCodes } from "./errorCodes";
import { ValidationError } from "../validation/v";

function body(message: string, code: string, label: string, key: string, extra?: Record<string, unknown>) {
  return { success: false, message, code, label, key, ...extra };
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof CustomAppError) {
    if (err.statusCode >= 500) console.error(err);
    return NextResponse.json(body(err.message, err.errorCode, err.errorLabel, err.errorKey, (err as CustomAppError & { details?: unknown }).details ? { details: (err as CustomAppError & { details?: unknown }).details } : undefined), { status: err.statusCode });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json(body(err.message, ErrorCodes.VALIDATION_FAILED.code, ErrorCodes.VALIDATION_FAILED.label, "validation_failed", { field: err.field }), { status: 400 });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json(body("Request body must be valid JSON", ErrorCodes.INVALID_INPUT.code, ErrorCodes.INVALID_INPUT.label, "invalid_json"), { status: 400 });
  }
  console.error(err); // full detail stays in server logs only
  if (err instanceof QueryFailedError) {
    const code = (err as QueryFailedError & { code?: string }).code;
    if (code === "23505") return NextResponse.json(body("A record with this value already exists", ErrorCodes.DUPLICATE_RESOURCE.code, ErrorCodes.DUPLICATE_RESOURCE.label, "duplicate"), { status: 409 });
    if (code === "23503") return NextResponse.json(body("This record is linked to other records", ErrorCodes.INTEGRITY_CONSTRAINT_VIOLATION.code, ErrorCodes.INTEGRITY_CONSTRAINT_VIOLATION.label, "integrity"), { status: 409 });
    if (code === "P0001") return NextResponse.json(body("This record is locked and cannot be changed", ErrorCodes.INVALID_STATE.code, ErrorCodes.INVALID_STATE.label, "immutable_record"), { status: 409 });
    return NextResponse.json(body("Database error", ErrorCodes.DATABASE_ERROR.code, ErrorCodes.DATABASE_ERROR.label, "database_error"), { status: 500 });
  }
  return NextResponse.json(body("Internal server error", ErrorCodes.INTERNAL_SERVER_ERROR.code, ErrorCodes.INTERNAL_SERVER_ERROR.label, "internal_error"), { status: 500 });
}

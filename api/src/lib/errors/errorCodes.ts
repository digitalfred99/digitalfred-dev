// Error codes returned by the API. Format: DFD_Exxxx.
export const ErrorCodes = {
  // ── General / system ─────────────────────────────────────────
  GENERAL_SYSTEM_ERROR:          { code: "DFD_E0001", label: "GENERAL_SYSTEM_ERROR" },
  INVALID_INPUT:                 { code: "DFD_E0002", label: "INVALID_INPUT" },
  VALIDATION_FAILED:             { code: "DFD_E0003", label: "VALIDATION_FAILED" },
  EMPTY_REQUEST:                 { code: "DFD_E0004", label: "EMPTY_REQUEST" },
  ID_REQUIRED:                   { code: "DFD_E0005", label: "ID_REQUIRED" },
  INPUT_REQUIRED:                { code: "DFD_E0006", label: "INPUT_REQUIRED" },
  RESOURCE_NOT_FOUND:            { code: "DFD_E0007", label: "RESOURCE_NOT_FOUND" },
  RECORD_NOT_FOUND:              { code: "DFD_E0008", label: "RECORD_NOT_FOUND" },
  RECORD_ALREADY_EXISTS:         { code: "DFD_E0009", label: "RECORD_ALREADY_EXISTS" },
  DUPLICATE_RESOURCE:            { code: "DFD_E0010", label: "DUPLICATE_RESOURCE" },
  DATABASE_ERROR:                { code: "DFD_E0011", label: "DATABASE_ERROR" },
  INTEGRITY_CONSTRAINT_VIOLATION:{ code: "DFD_E0012", label: "INTEGRITY_CONSTRAINT_VIOLATION" },
  CONCURRENT_MODIFICATION:       { code: "DFD_E0013", label: "CONCURRENT_MODIFICATION" },
  PRECONDITION_FAILED:           { code: "DFD_E0014", label: "PRECONDITION_FAILED" },
  INVALID_STATE:                 { code: "DFD_E0015", label: "INVALID_STATE" },
  OPERATION_TIMEOUT:             { code: "DFD_E0016", label: "OPERATION_TIMEOUT" },
  SERVICE_UNAVAILABLE:           { code: "DFD_E0017", label: "SERVICE_UNAVAILABLE" },
  UNSUPPORTED_OPERATION:         { code: "DFD_E0018", label: "UNSUPPORTED_OPERATION" },
  RATE_LIMIT_EXCEEDED:           { code: "DFD_E0019", label: "RATE_LIMIT_EXCEEDED" },
  CONFIGURATION_ERROR:           { code: "DFD_E0020", label: "CONFIGURATION_ERROR" },

  // ── Generic CRUD ─────────────────────────────────────────────
  CREATION_FAILED:               { code: "DFD_E0100", label: "CREATION_FAILED" },
  UPDATE_FAILED:                 { code: "DFD_E0101", label: "UPDATE_FAILED" },
  DELETION_FAILED:               { code: "DFD_E0102", label: "DELETION_FAILED" },
  RETRIEVAL_FAILED:              { code: "DFD_E0103", label: "RETRIEVAL_FAILED" },
  BULK_REQUEST_ERROR:            { code: "DFD_E0104", label: "SOME_FIELDS_FAILED_TO_PROCESS" },

  // ── Auth ─────────────────────────────────────────────────────
  UNAUTHORIZED_ACCESS:           { code: "DFD_E0200", label: "UNAUTHORIZED_ACCESS" },
  PERMISSION_DENIED:             { code: "DFD_E0201", label: "PERMISSION_DENIED" },
  INVALID_CREDENTIALS:           { code: "DFD_E0202", label: "INVALID_CREDENTIALS" },
  SESSION_EXPIRED:               { code: "DFD_E0203", label: "SESSION_EXPIRED" },
  INVALID_TOKEN:                 { code: "DFD_E0204", label: "INVALID_TOKEN" },
  TOKEN_EXPIRED:                 { code: "DFD_E0205", label: "TOKEN_EXPIRED" },

  // ── Account status ───────────────────────────────────────────
  ACCOUNT_INACTIVE:              { code: "DFD_E0301", label: "ACCOUNT_INACTIVE" },
  ACCOUNT_DELETED:               { code: "DFD_E0306", label: "ACCOUNT_DELETED" },
  USER_NOT_FOUND:                { code: "DFD_E0307", label: "USER_NOT_FOUND" },

  // ── Public portal ────────────────────────────────────────────
  LINK_INVALID:                  { code: "DFD_E0400", label: "LINK_INVALID" },
  PROPOSAL_NOT_ACTIONABLE:       { code: "DFD_E0401", label: "PROPOSAL_NOT_ACTIONABLE" },
  READINESS_FAILED:              { code: "DFD_E0402", label: "READINESS_FAILED" },
  ACCOUNT_LOCKED:                { code: "DFD_E0302", label: "ACCOUNT_LOCKED" },

  // ── Fallback ─────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR:         { code: "DFD_E9999", label: "INTERNAL_SERVER_ERROR" },
  EXTERNAL_SERVER_ERROR:         { code: "DFD_E9998", label: "EXTERNAL_SERVER_ERROR" },
  UNEXPECTED_RUNTIME_ERROR:      { code: "DFD_E9997", label: "UNEXPECTED_RUNTIME_ERROR" },
} as const;

export type ErrorCodeKey = keyof typeof ErrorCodes;

import { NextResponse } from "next/server";

export type ApiResponse<T = unknown> = { success: boolean; code: string; message: string; data?: T; meta?: Record<string, unknown> };

export function customResponse<T>(code: string, message: string, status: number, data?: T, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiResponse<T>>(
    { success: status < 400, code, message, ...(data !== undefined && { data }), ...(meta && { meta }) },
    { status, headers: { "cache-control": "no-store" } }
  );
}

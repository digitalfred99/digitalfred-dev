// src/lib/http/parseFormData.ts
export interface ParsedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export async function extractFile(
  formData: FormData,
  fieldName: string
): Promise<ParsedFile | undefined> {
  const value = formData.get(fieldName);
  if (!value || !(value instanceof File)) return undefined;

  const arrayBuffer = await value.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    originalName: value.name,
    mimeType: value.type,
  };
}

/** Pulls a plain string field out of FormData, or undefined if absent/empty. */
export function extractField(formData: FormData, fieldName: string): string | undefined {
  const value = formData.get(fieldName);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
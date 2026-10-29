import "reflect-metadata";
import { DataSource } from "typeorm";
import { buildOptions } from "./data-source-options";

declare global {
  // eslint-disable-next-line no-var
  var __appDataSource: DataSource | undefined;
  // eslint-disable-next-line no-var
  var __appDataSourceInitPromise: Promise<DataSource> | undefined;
}

export const AppDataSource = async (): Promise<DataSource> => {
  if (globalThis.__appDataSource?.isInitialized) {
    return globalThis.__appDataSource;
  }

  if (!globalThis.__appDataSourceInitPromise) {
    const ds = globalThis.__appDataSource ?? new DataSource(buildOptions());
    globalThis.__appDataSource = ds;
    globalThis.__appDataSourceInitPromise = ds.initialize().catch((err) => {
      // Allow retry on next call if initialization failed
      globalThis.__appDataSourceInitPromise = undefined;
      globalThis.__appDataSource = undefined;
      throw err;
    });
  }

  await globalThis.__appDataSourceInitPromise;
  return globalThis.__appDataSource!;
};
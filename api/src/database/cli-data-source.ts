import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { buildOptions } from "./data-source-options";

export default new DataSource({ ...buildOptions(), migrations: ["src/migrations/*.ts"] });

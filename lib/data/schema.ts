import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startYear: integer("start_year").notNull(),
  teamCount: integer("team_count").notNull(),
  useDh: integer("use_dh", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

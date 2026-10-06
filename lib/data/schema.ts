import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startYear: integer("start_year").notNull(),
  teamCount: integer("team_count").notNull(),
  useDh: integer("use_dh", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const teams = sqliteTable(
  "teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id),
    number: integer("number").notNull(),
    city: text("city"),
    name: text("name"),
    gmName: text("gm_name"),
    gmRisk: text("gm_risk"),
    gmDevFocus: text("gm_dev_focus"),
    gmTeamBuilding: text("gm_team_building"),
    managerName: text("manager_name"),
    ballparkName: text("ballpark_name"),
    ballparkQuality: text("ballpark_quality").notNull().default("neutral"),
    cityRoll: integer("city_roll"),
    gmRiskRoll: integer("gm_risk_roll"),
    gmDevFocusRoll: integer("gm_dev_focus_roll"),
    gmTeamBuildingRoll: integer("gm_team_building_roll"),
  },
  (table) => [
    uniqueIndex("teams_league_number_unique").on(table.leagueId, table.number),
  ],
);

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

// One table for pitchers and, from feature 4, position players. The pitcher
// columns are always filled for a pitcher, except stamina for a reliever.
export const players = sqliteTable(
  "players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id),
    teamId: integer("team_id").references(() => teams.id),
    slot: text("slot"),
    kind: text("kind").notNull(),
    naturalPosition: text("natural_position").notNull(),
    name: text("name"),
    nameListId: integer("name_list_id"),
    age: integer("age").notNull(),
    grade: text("grade"),
    gradeCeiling: text("grade_ceiling"),
    hrTendency: text("hr_tendency"),
    stamina: integer("stamina"),
    breakthroughUsed: integer("breakthrough_used", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("players_team_slot_unique").on(table.teamId, table.slot),
    // SQLite treats nulls as distinct, so unnamed players do not collide.
    uniqueIndex("players_league_name_unique").on(
      table.leagueId,
      table.nameListId,
    ),
  ],
);

// The dice behind one rolled value on a player. Team rolls stay on the team
// row.
export const rolls = sqliteTable(
  "rolls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    attribute: text("attribute").notNull(),
    tableKey: text("table_key").notNull(),
    dice: text("dice").notNull(),
    result: text("result").notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    uniqueIndex("rolls_player_attribute_unique").on(
      table.playerId,
      table.attribute,
    ),
  ],
);

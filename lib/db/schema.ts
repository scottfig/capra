import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull(),
  task: text("task").notNull(),
  status: text("status").notNull().default("running"), // running | complete | failed
  trace: jsonb("trace").notNull().default([]),
  code_output: jsonb("code_output"), // array of { language, code } objects
  findings: jsonb("findings"),
  is_public: boolean("is_public").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

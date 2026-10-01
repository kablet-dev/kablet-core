CREATE TABLE IF NOT EXISTS "infrastructure_ledger" (
  "id" serial PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

import { db } from "./db";

export type Criterion = { weight: number; description: string };

export type Thesis = {
  version: number;
  accelerator_name: string;
  summary: string;
  sectors: string[];
  excluded_sectors: string[];
  stages: string[];
  geographies: string[];
  business_models: string[];
  criteria: Record<string, Criterion>;
  threshold: number;
  fresh_window_hours: number;
  late_catch_days: number;
  program_pitch: string;
  sender_name: string;
  sender_title: string;
  updated_at: Date;
};

// Always read fresh from Supabase at the moment of use: no caching, so an edit in the
// Table Editor applies to the very next assessment without a deploy.
export async function loadActiveThesis(): Promise<Thesis> {
  const rows = await db()<Thesis[]>`
    select version, accelerator_name, summary, sectors, excluded_sectors, stages, geographies,
           business_models, criteria, threshold::float8 as threshold, fresh_window_hours,
           late_catch_days, program_pitch, sender_name, sender_title, updated_at
    from thesis where id = 1`;
  if (!rows[0]) throw new Error("No thesis row found (table thesis, id = 1)");
  return rows[0];
}

export async function listThesisVersions(limit = 20) {
  return db()<{ version: number; created_at: Date; snapshot: Record<string, unknown> }[]>`
    select version, created_at, snapshot from thesis_versions order by version desc limit ${limit}`;
}

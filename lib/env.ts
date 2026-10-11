// Central access to environment variables. Throws a clear error naming the missing variable.
export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Safe mode is permanent for this project: every email goes to this inbox, never to a founder.
export const EMAIL_OVERRIDE_TO = () => env("EMAIL_OVERRIDE_TO");

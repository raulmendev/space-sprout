/** The environment the API needs, checked once at startup. */
export interface Env {
  DATABASE_URL: string;
  /** Direct (unpooled) Neon host for migrations; falls back to DATABASE_URL. */
  DATABASE_URL_UNPOOLED?: string;
  PORT: number;
  /** Who may call the API from a browser: the listed origins, or any local dev server when none are listed. */
  CORS_ORIGINS: (string | RegExp)[];
}

/** Any port on this machine (localhost, 127.0.0.1, [::1]), over http or https: every local dev server. */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function validateEnv(raw: Record<string, unknown>): Env {
  const text = (key: string) => {
    const value = raw[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const databaseUrl = text('DATABASE_URL');
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing. Copy api/.env.example to api/.env and paste the Neon connection string.',
    );
  }

  const port = Number(text('PORT') ?? 3000);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT must be a positive integer, got "${raw['PORT']}".`);

  return {
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: text('DATABASE_URL_UNPOOLED'),
    PORT: port,
    CORS_ORIGINS: text('CORS_ORIGINS')
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [LOCAL_ORIGIN],
  };
}

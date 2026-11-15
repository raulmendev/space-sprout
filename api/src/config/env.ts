/** The environment the API needs, checked once at startup. */
export interface Env {
  DATABASE_URL: string;
  /** Direct (unpooled) Neon host for migrations; falls back to DATABASE_URL. */
  DATABASE_URL_UNPOOLED?: string;
  PORT: number;
  CORS_ORIGINS: string[];
}

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
    CORS_ORIGINS: (text('CORS_ORIGINS') ?? 'http://localhost:4200,http://localhost:4201')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

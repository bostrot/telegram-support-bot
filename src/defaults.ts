/**
 * Default MongoDB connection string: the MONGO_URI environment variable (set by
 * docker compose) beats the built-in default. MONGO_URI also overrides an explicit
 * mongodb_uri in config.yaml, because cache.ts applies it after the parsed config (#199).
 */
export function defaultMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  return env.MONGO_URI || 'mongodb://mongodb:27017/support';
}

/**
 * Default MongoDB connection string: the MONGO_URI environment variable (set by
 * docker compose) beats the built-in default. An explicit mongodb_uri in config.yaml
 * still overrides both, because the parsed config is applied on top of the defaults.
 */
export function defaultMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  return env.MONGO_URI || 'mongodb://mongodb:27017/support';
}

export type CloudKitEnvironment = 'development' | 'production'

export interface CloudKitConfig {
  containerIdentifier: string
  apiToken: string
  environment: CloudKitEnvironment
}

export function readCloudKitConfig(env: ImportMetaEnv = import.meta.env): CloudKitConfig | null {
  const containerIdentifier = env.VITE_CLOUDKIT_CONTAINER_ID?.trim()
  const apiToken = env.VITE_CLOUDKIT_API_TOKEN?.trim()
  const environment = env.VITE_CLOUDKIT_ENVIRONMENT?.trim().toLowerCase()

  if (!containerIdentifier || !apiToken) return null
  if (environment !== 'development' && environment !== 'production') return null

  return { containerIdentifier, apiToken, environment }
}

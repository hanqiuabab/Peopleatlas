import { describe, expect, it } from 'vitest'
import { readCloudKitConfig } from './cloudKitConfig'

describe('CloudKit build configuration', () => {
  it('requires a container, token, and valid environment', () => {
    expect(readCloudKitConfig({} as ImportMetaEnv)).toBeNull()
    expect(readCloudKitConfig({
      VITE_CLOUDKIT_CONTAINER_ID: 'iCloud.example',
      VITE_CLOUDKIT_API_TOKEN: 'token',
      VITE_CLOUDKIT_ENVIRONMENT: 'invalid',
    } as unknown as ImportMetaEnv)).toBeNull()
  })

  it('normalizes a complete configuration', () => {
    expect(readCloudKitConfig({
      VITE_CLOUDKIT_CONTAINER_ID: ' iCloud.com.hanqiu.peopleatlas ',
      VITE_CLOUDKIT_API_TOKEN: ' token ',
      VITE_CLOUDKIT_ENVIRONMENT: 'production',
    } as ImportMetaEnv)).toEqual({
      containerIdentifier: 'iCloud.com.hanqiu.peopleatlas',
      apiToken: 'token',
      environment: 'production',
    })
  })
})

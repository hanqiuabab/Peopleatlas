import type { RelationshipNetwork } from '../../domain/network'
import { sanitizeNetwork } from '../storage/networkRepository'
import type { CloudKitConfig } from './cloudKitConfig'
import type { CloudNetworkSnapshot } from './cloudNetwork'

const CLOUDKIT_SCRIPT_URL = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js'
const RECORD_NAME = 'primary-network-v1'
const RECORD_TYPE = 'PeopleAtlasWebNetwork'

export interface CloudKitUserIdentity {
  userRecordName: string
}

interface CloudKitErrorLike {
  ckErrorCode?: string
  message?: string
  reason?: string
  serverErrorCode?: string
}

export interface CloudKitRecordField {
  type?: string
  value: unknown
}

export interface CloudKitRecord {
  recordName: string
  recordType?: string
  recordChangeTag?: string
  fields?: Record<string, CloudKitRecordField>
}

export interface CloudKitRecordsResponse {
  hasErrors?: boolean
  errors?: CloudKitErrorLike[]
  records: CloudKitRecord[]
}

export interface CloudKitDatabase {
  fetchRecords(records: string | string[]): Promise<CloudKitRecordsResponse>
  saveRecords(records: CloudKitRecord | CloudKitRecord[]): Promise<CloudKitRecordsResponse>
}

export interface CloudKitContainer {
  privateCloudDatabase: CloudKitDatabase
  setUpAuth(): Promise<CloudKitUserIdentity | null>
  whenUserSignsIn(): Promise<CloudKitUserIdentity>
  whenUserSignsOut(): Promise<void>
}

export interface CloudKitNamespace {
  DEVELOPMENT_ENVIRONMENT: string
  PRODUCTION_ENVIRONMENT: string
  configure(config: unknown): void
  getDefaultContainer(): CloudKitContainer
}

declare global {
  interface Window {
    CloudKit?: CloudKitNamespace
  }
}

export class CloudKitOperationError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'CloudKitOperationError'
    this.code = code
  }
}

function operationError(error: unknown, fallback: string): CloudKitOperationError {
  if (error instanceof CloudKitOperationError) return error
  if (error && typeof error === 'object') {
    const candidate = error as CloudKitErrorLike
    return new CloudKitOperationError(
      candidate.reason ?? candidate.message ?? fallback,
      candidate.serverErrorCode ?? candidate.ckErrorCode,
    )
  }
  return new CloudKitOperationError(fallback)
}

function responseError(response: CloudKitRecordsResponse): CloudKitOperationError | null {
  const error = response.errors?.[0]
  if (!response.hasErrors && !error) return null
  return operationError(error, 'iCloud 返回了未知错误')
}

function parseSnapshot(record: CloudKitRecord): CloudNetworkSnapshot {
  const payload = record.fields?.payload?.value
  const updatedAt = record.fields?.updatedAt?.value
  if (typeof payload !== 'string' || typeof updatedAt !== 'string' || !record.recordChangeTag) {
    throw new CloudKitOperationError('iCloud 中的图谱数据格式不完整')
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(payload)
  } catch {
    throw new CloudKitOperationError('iCloud 中的图谱数据无法解析')
  }

  return {
    network: sanitizeNetwork(decoded),
    changeTag: record.recordChangeTag,
    updatedAt,
  }
}

function createRecord(network: RelationshipNetwork, changeTag?: string): CloudKitRecord {
  return {
    recordName: RECORD_NAME,
    recordType: RECORD_TYPE,
    ...(changeTag ? { recordChangeTag: changeTag } : {}),
    fields: {
      payload: { type: 'STRING', value: JSON.stringify(network) },
      schemaVersion: { type: 'INT64', value: 1 },
      updatedAt: { type: 'STRING', value: new Date().toISOString() },
    },
  }
}

export interface CloudKitClient {
  setUpAuth(): Promise<CloudKitUserIdentity | null>
  whenUserSignsIn(): Promise<CloudKitUserIdentity>
  whenUserSignsOut(): Promise<void>
  fetchNetwork(): Promise<CloudNetworkSnapshot | null>
  saveNetwork(network: RelationshipNetwork, changeTag?: string): Promise<CloudNetworkSnapshot>
}

export function createCloudKitClientFromNamespace(
  cloudKit: CloudKitNamespace,
  config: CloudKitConfig,
): CloudKitClient {
  cloudKit.configure({
    containers: [{
      containerIdentifier: config.containerIdentifier,
      environment: config.environment === 'production'
        ? cloudKit.PRODUCTION_ENVIRONMENT
        : cloudKit.DEVELOPMENT_ENVIRONMENT,
      apiTokenAuth: {
        apiToken: config.apiToken,
        persist: true,
        signInButton: { id: 'apple-sign-in-button', theme: 'black' },
        signOutButton: { id: 'apple-sign-out-button', theme: 'black' },
      },
    }],
    services: { logger: window.console },
  })

  const container = cloudKit.getDefaultContainer()
  const database = container.privateCloudDatabase

  return {
    setUpAuth: () => container.setUpAuth(),
    whenUserSignsIn: () => container.whenUserSignsIn(),
    whenUserSignsOut: () => container.whenUserSignsOut(),
    async fetchNetwork() {
      try {
        const response = await database.fetchRecords(RECORD_NAME)
        const error = responseError(response)
        if (error?.code === 'NOT_FOUND') return null
        if (error) throw error
        const record = response.records[0]
        return record ? parseSnapshot(record) : null
      } catch (error) {
        const converted = operationError(error, '无法从 iCloud 读取图谱')
        if (converted.code === 'NOT_FOUND') return null
        throw converted
      }
    },
    async saveNetwork(network, changeTag) {
      try {
        const response = await database.saveRecords(createRecord(network, changeTag))
        const error = responseError(response)
        if (error) throw error
        const record = response.records[0]
        if (!record) throw new CloudKitOperationError('iCloud 未返回已保存的图谱')
        return parseSnapshot(record)
      } catch (error) {
        throw operationError(error, '无法将图谱保存到 iCloud')
      }
    },
  }
}

let scriptPromise: Promise<CloudKitNamespace> | undefined

function loadCloudKit(): Promise<CloudKitNamespace> {
  if (window.CloudKit) return Promise.resolve(window.CloudKit)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CLOUDKIT_SCRIPT_URL
    script.async = true
    script.onload = () => window.CloudKit
      ? resolve(window.CloudKit)
      : reject(new CloudKitOperationError('CloudKit JS 加载后未正确初始化'))
    script.onerror = () => reject(new CloudKitOperationError('无法加载 CloudKit JS，请检查网络后重试'))
    document.head.append(script)
  })
  return scriptPromise
}

export async function createCloudKitClient(config: CloudKitConfig): Promise<CloudKitClient> {
  return createCloudKitClientFromNamespace(await loadCloudKit(), config)
}

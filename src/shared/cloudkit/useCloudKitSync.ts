import { useCallback, useEffect, useRef, useState } from 'react'
import type { RelationshipNetwork } from '../../domain/network'
import {
  CloudKitOperationError,
  createCloudKitClient,
  type CloudKitClient,
  type CloudKitUserIdentity,
} from './cloudKitClient'
import { readCloudKitConfig } from './cloudKitConfig'
import {
  isNetworkEmpty,
  mergeNetworks,
  networkFingerprint,
  type CloudNetworkSnapshot,
} from './cloudNetwork'
import { loadCloudSyncFingerprint, saveCloudSyncFingerprint } from './cloudSyncMetadata'

export type CloudSyncStatus =
  | 'unconfigured'
  | 'loading'
  | 'signedOut'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'conflict'

export interface CloudSyncConflict {
  local: RelationshipNetwork
  cloud: CloudNetworkSnapshot
}

export type ConflictResolution = 'merge' | 'local' | 'cloud'

function errorMessage(error: unknown): string {
  if (error instanceof CloudKitOperationError) {
    switch (error.code) {
      case 'NETWORK_ERROR':
      case 'SERVICE_UNAVAILABLE':
      case 'TRY_AGAIN_LATER':
        return 'iCloud 暂时不可用，本地更改已保留，稍后可重试。'
      case 'QUOTA_EXCEEDED':
        return 'iCloud 空间不足，本地更改已保留。'
      case 'AUTHENTICATION_REQUIRED':
      case 'AUTHENTICATION_FAILED':
        return '请重新登录 Apple 账户后再同步。'
      default:
        return error.message
    }
  }
  return '无法完成 iCloud 同步，本地数据未丢失。'
}

export function useCloudKitSync(
  network: RelationshipNetwork,
  replaceNetwork: (network: RelationshipNetwork) => void,
) {
  const config = useRef(readCloudKitConfig()).current
  const clientRef = useRef<CloudKitClient | undefined>(undefined)
  const networkRef = useRef(network)
  const replaceNetworkRef = useRef(replaceNetwork)
  const changeTagRef = useRef<string | undefined>(undefined)
  const lastSyncedFingerprintRef = useRef<string | undefined>(undefined)
  const signedInRef = useRef(false)
  const readyRef = useRef(false)
  const syncingRef = useRef(false)
  const conflictRef = useRef<CloudSyncConflict | undefined>(undefined)
  const currentUserRecordNameRef = useRef<string | undefined>(undefined)
  const [status, setStatus] = useState<CloudSyncStatus>(config ? 'loading' : 'unconfigured')
  const [message, setMessage] = useState(config ? '正在连接 iCloud…' : '需要配置 CloudKit Web API Token')
  const [lastSyncedAt, setLastSyncedAt] = useState<string>()
  const [conflict, setConflict] = useState<CloudSyncConflict>()
  const [isConflictOpen, setConflictOpen] = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)

  networkRef.current = network
  replaceNetworkRef.current = replaceNetwork

  const rememberSnapshot = useCallback((snapshot: CloudNetworkSnapshot) => {
    changeTagRef.current = snapshot.changeTag
    lastSyncedFingerprintRef.current = networkFingerprint(snapshot.network)
    if (currentUserRecordNameRef.current) {
      saveCloudSyncFingerprint(
        currentUserRecordNameRef.current,
        lastSyncedFingerprintRef.current,
      )
    }
    setLastSyncedAt(snapshot.updatedAt)
    setStatus('synced')
    setMessage('iCloud 已同步')
  }, [])

  const applyCloudSnapshot = useCallback((snapshot: CloudNetworkSnapshot) => {
    rememberSnapshot(snapshot)
    replaceNetworkRef.current(snapshot.network)
  }, [rememberSnapshot])

  const saveLocal = useCallback(async (
    local: RelationshipNetwork,
    changeTag?: string,
  ) => {
    const client = clientRef.current
    if (!client) return
    const saved = await client.saveNetwork(local, changeTag)
    rememberSnapshot({ ...saved, network: local })
  }, [rememberSnapshot])

  const presentConflict = useCallback((nextConflict: CloudSyncConflict) => {
    conflictRef.current = nextConflict
    setConflict(nextConflict)
    setConflictOpen(true)
    setStatus('conflict')
    setMessage('本地与 iCloud 都有新更改，请选择处理方式')
  }, [])

  const synchronize = useCallback(async () => {
    const client = clientRef.current
    if (!client || !signedInRef.current || syncingRef.current || conflictRef.current) return

    syncingRef.current = true
    setStatus('syncing')
    setMessage('正在与 iCloud 同步…')
    try {
      const local = networkRef.current
      const localFingerprint = networkFingerprint(local)
      const cloud = await client.fetchNetwork()

      if (!cloud) {
        await saveLocal(local)
        readyRef.current = true
        return
      }

      const cloudFingerprint = networkFingerprint(cloud.network)
      const lastSyncedFingerprint = lastSyncedFingerprintRef.current
      changeTagRef.current = cloud.changeTag

      if (localFingerprint === cloudFingerprint) {
        rememberSnapshot(cloud)
      } else if (lastSyncedFingerprint === localFingerprint || isNetworkEmpty(local)) {
        applyCloudSnapshot(cloud)
      } else if (lastSyncedFingerprint === cloudFingerprint) {
        await saveLocal(local, cloud.changeTag)
      } else {
        presentConflict({ local, cloud })
      }
      readyRef.current = true
    } catch (error) {
      setStatus('error')
      setMessage(errorMessage(error))
    } finally {
      syncingRef.current = false
    }
  }, [applyCloudSnapshot, presentConflict, rememberSnapshot, saveLocal])

  const beginSignedInSession = useCallback(async (identity: CloudKitUserIdentity) => {
    signedInRef.current = true
    readyRef.current = false
    currentUserRecordNameRef.current = identity.userRecordName
    lastSyncedFingerprintRef.current = loadCloudSyncFingerprint(identity.userRecordName)
    changeTagRef.current = undefined
    conflictRef.current = undefined
    setConflict(undefined)
    setConflictOpen(false)
    setSessionVersion((value) => value + 1)
    await synchronize()
  }, [synchronize])

  useEffect(() => {
    if (!config) return
    let active = true

    void (async () => {
      try {
        const client = await createCloudKitClient(config)
        if (!active) return
        clientRef.current = client
        const identity = await client.setUpAuth()
        if (!active) return

        if (identity) await beginSignedInSession(identity)
        else {
          signedInRef.current = false
          setStatus('signedOut')
          setMessage('登录 Apple 账户后可同步到私有 iCloud')
        }

        const watchSignIn = () => {
          void client.whenUserSignsIn().then((signedInIdentity) => {
            if (!active) return
            if (!signedInRef.current) void beginSignedInSession(signedInIdentity)
            watchSignOut()
          }).catch((error: unknown) => {
            if (active) {
              setStatus('error')
              setMessage(errorMessage(error))
            }
          })
        }
        const watchSignOut = () => {
          void client.whenUserSignsOut().then(() => {
            if (!active) return
            signedInRef.current = false
            readyRef.current = false
            currentUserRecordNameRef.current = undefined
            conflictRef.current = undefined
            setConflict(undefined)
            setConflictOpen(false)
            setSessionVersion((value) => value + 1)
            setStatus('signedOut')
            setMessage('已退出 Apple 账户，当前浏览器数据仍可离线使用')
            watchSignIn()
          }).catch((error: unknown) => {
            if (active) {
              setStatus('error')
              setMessage(errorMessage(error))
            }
          })
        }
        if (identity) watchSignOut()
        else watchSignIn()
      } catch (error) {
        if (!active) return
        setStatus('error')
        setMessage(errorMessage(error))
      }
    })()

    return () => { active = false }
  }, [beginSignedInSession, config])

  useEffect(() => {
    if (!signedInRef.current || !readyRef.current || conflictRef.current) return
    const fingerprint = networkFingerprint(network)
    if (fingerprint === lastSyncedFingerprintRef.current) return

    setStatus('pending')
    setMessage('已保存到本机，即将同步到 iCloud…')
    const timer = window.setTimeout(() => void synchronize(), 700)
    return () => window.clearTimeout(timer)
  }, [network, sessionVersion, synchronize])

  useEffect(() => {
    if (!config) return
    const refresh = () => {
      if (document.visibilityState === 'visible') void synchronize()
    }
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [config, sessionVersion, synchronize])

  const resolveConflict = useCallback(async (resolution: ConflictResolution) => {
    const current = conflictRef.current
    if (!current || syncingRef.current) return
    conflictRef.current = undefined
    setConflictOpen(false)
    setStatus('syncing')
    setMessage('正在处理本地与 iCloud 的差异…')
    syncingRef.current = true
    try {
      if (resolution === 'cloud') {
        applyCloudSnapshot(current.cloud)
      } else {
        const selected = resolution === 'merge'
          ? mergeNetworks(current.local, current.cloud.network)
          : current.local
        const saved = await clientRef.current!.saveNetwork(selected, current.cloud.changeTag)
        rememberSnapshot({ ...saved, network: selected })
        replaceNetworkRef.current(selected)
      }
      setConflict(undefined)
      readyRef.current = true
    } catch (error) {
      conflictRef.current = current
      setConflict(current)
      setStatus('error')
      setMessage(`${errorMessage(error)} 请重新检查冲突后再试。`)
    } finally {
      syncingRef.current = false
    }
  }, [applyCloudSnapshot, rememberSnapshot])

  return {
    status,
    message,
    lastSyncedAt,
    conflict,
    isConflictOpen,
    retry: synchronize,
    openConflict: () => setConflictOpen(true),
    dismissConflict: () => setConflictOpen(false),
    resolveConflict,
  }
}

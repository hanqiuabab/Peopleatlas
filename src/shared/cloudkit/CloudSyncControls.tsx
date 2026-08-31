import { Modal } from '../components/Modal'
import type { useCloudKitSync } from './useCloudKitSync'

type CloudSyncModel = ReturnType<typeof useCloudKitSync>

const STATUS_LABELS: Record<CloudSyncModel['status'], string> = {
  unconfigured: 'iCloud 待配置',
  loading: '连接 iCloud',
  signedOut: '未登录',
  pending: '待同步',
  syncing: '同步中',
  synced: '已同步',
  error: '同步失败',
  conflict: '需要处理',
}

export function CloudSyncControls({ model }: { model: CloudSyncModel }) {
  const actionable = model.status === 'error' || model.status === 'conflict'
  return (
    <>
      <div className={`cloud-sync cloud-sync--${model.status}`} title={model.message}>
        <button
          type="button"
          className="cloud-sync__status"
          disabled={!actionable}
          onClick={() => model.status === 'conflict' ? model.openConflict() : void model.retry()}
          aria-label={`${STATUS_LABELS[model.status]}：${model.message}`}
        >
          <span className="cloud-sync__dot" aria-hidden="true" />
          <span>{STATUS_LABELS[model.status]}</span>
        </button>
        <div id="apple-sign-in-button" className="cloud-sync__apple-button" />
        <div id="apple-sign-out-button" className="cloud-sync__apple-button" />
      </div>

      {model.conflict && model.isConflictOpen && (
        <Modal
          title="选择 iCloud 同步方式"
          description="本地与 iCloud 都有不同的图谱数据。在你明确选择前，网页不会覆盖任何一份数据。"
          onClose={model.dismissConflict}
        >
          <div className="cloud-conflict">
            <div className="cloud-conflict__summary">
              <div><strong>{model.conflict.local.people.length}</strong><span>本地人物</span></div>
              <div><strong>{model.conflict.cloud.network.people.length}</strong><span>iCloud 人物</span></div>
              <div><strong>{model.conflict.local.relationships.length}</strong><span>本地关系</span></div>
              <div><strong>{model.conflict.cloud.network.relationships.length}</strong><span>iCloud 关系</span></div>
            </div>
            <button className="cloud-conflict__choice is-recommended" type="button" onClick={() => void model.resolveConflict('merge')}>
              <strong>合并两份数据</strong>
              <span>保留两边不同 ID 的记录；相同 ID 使用更新时间较新的版本。</span>
            </button>
            <button className="cloud-conflict__choice" type="button" onClick={() => void model.resolveConflict('local')}>
              <strong>使用本地数据</strong>
              <span>用当前浏览器中的完整图谱覆盖 iCloud 版本。</span>
            </button>
            <button className="cloud-conflict__choice" type="button" onClick={() => void model.resolveConflict('cloud')}>
              <strong>使用 iCloud 数据</strong>
              <span>将 iCloud 图谱载入当前浏览器。</span>
            </button>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={model.dismissConflict}>稍后处理</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

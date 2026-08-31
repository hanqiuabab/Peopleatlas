import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = '确认删除',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-message">{message}</p>
      <footer className="form-actions">
        <button className="button button--ghost" type="button" onClick={onCancel}>
          取消
        </button>
        <button className="button button--danger" type="button" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  )
}


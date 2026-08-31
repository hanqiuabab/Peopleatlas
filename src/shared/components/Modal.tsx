import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ title, description, children, onClose }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="eyebrow">编辑面板</p>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="modal__description">{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}


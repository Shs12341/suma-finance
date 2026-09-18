import { useEffect } from "react"
import Icon from "./Icon"

function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", busy = false, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onCancel()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [busy, onCancel, open])

  if (!open) return null

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className={`dialog-icon ${tone}`}>
          <Icon name={tone === "danger" ? "trash" : "security"} size={20} />
        </div>
        <div className="dialog-copy">
          <h2 id="confirm-dialog-title">{title}</h2>
          <p>{message}</p>
        </div>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className={`primary-button ${tone === "danger" ? "danger-button" : ""}`} type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmDialog

// Code execution is intentionally DISABLED. Running user code safely needs an
// isolated sandbox (container with CPU, memory, time and network limits).
// This panel is the place where a future execution service will plug in.
export default function OutputPanel({ onClose }) {
  return (
    <div className="output-panel">
      <div className="output-header">
        <span>OUTPUT</span>
        <button className="icon-btn small-icon" onClick={onClose}
                aria-label="Close output panel">✕</button>
      </div>
      <p className="muted small">
        Code execution is disabled. Running user-submitted code needs a secure,
        isolated sandbox, and it must never run inside the Django server.
        This panel is reserved for a future sandbox service.
      </p>
    </div>
  )
}
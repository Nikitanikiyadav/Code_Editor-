import { useEffect, useRef } from 'react'
import { languageLabel } from '../../constants/languages'
import { LIMITS } from '../../services/runner'

export default function OutputPanel({ output, onClear, onClose }) {
  const ref = useRef(null)
  const { lines, result, running, language } = output

  // Keep the newest line in view
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output])

  return (
    <div className="output-panel" ref={ref}>
      <div className="output-header">
        <span>OUTPUT{running ? ' · running...' : ''}</span>
        <span className="output-actions">
          <button className="btn btn-secondary small-btn" onClick={onClear}>Clear</button>
          <button className="icon-btn small-icon" onClick={onClose}
                  aria-label="Close output panel">✕</button>
        </span>
      </div>

      {!running && !result && lines.length === 0 && (
        <p className="muted small">
          Press ▶ Run to execute JavaScript or Python. Your code runs inside your
          own browser in an isolated worker, never on the server.
        </p>
      )}

      {/* Rendered as plain text by React, so program output can never inject HTML */}
      {lines.length > 0 && (
        <pre className="output-body" aria-live="polite">
          {lines.map((l, i) => (
            <span key={i} className={l.kind === 'err' ? 'out-err' : undefined}>
              {l.text}{'\n'}
            </span>
          ))}
        </pre>
      )}

      {result?.status === 'ok' && <p className="run-ok small">✓ Finished without errors</p>}

      {result?.status === 'error' && (
        <div className="run-error" role="alert">
          <p>
            <strong>{result.error.type}</strong>
            {result.error.line ? ` on line ${result.error.line}` : ''}
          </p>
          <p className="mono">{result.error.message}</p>
          <p><strong>What it means:</strong> {result.explanation.explanation}</p>
          <p><strong>How to fix:</strong> {result.explanation.tip}</p>
        </div>
      )}

      {result?.status === 'timeout' && (
        <p className="run-error small" role="alert">
          {result.phase === 'load'
            ? 'The Python runtime took too long to load. Check your internet connection.'
            : `⏱ Stopped after ${LIMITS.runMs / 1000} seconds. Check for an infinite loop, such as a while loop that never ends.`}
        </p>
      )}

      {result?.status === 'stopped' && <p className="muted small">■ Stopped.</p>}

      {result?.status === 'unsupported' && (
        <p className="muted small">
          Running {languageLabel(language)} needs a secure server-side sandbox, which
          is not enabled. JavaScript and Python run in your browser.
        </p>
      )}
    </div>
  )
}
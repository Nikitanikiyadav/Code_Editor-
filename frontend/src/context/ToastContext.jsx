import { createContext, useCallback, useMemo, useRef, useState } from 'react'

export const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const remove = useCallback(
    (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    [],
  )

  const show = useCallback(
    (message, type) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, message, type }])
      setTimeout(() => remove(id), 4000) // auto-dismiss after 4 seconds
    },
    [remove],
  )

  // useMemo keeps the same object between renders, so components using it don't re-render needlessly
  const api = useMemo(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live tells screen readers to announce new toasts */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
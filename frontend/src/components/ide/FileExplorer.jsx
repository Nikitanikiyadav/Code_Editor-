import { useState } from 'react'

export default function FileExplorer({
  files, activeId, canEdit, onSelect, onCreate, onRename, onDelete,
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const ok = await onCreate(name.trim())
    if (ok) {
      setName('')
      setAdding(false)
    }
  }

  return (
    <div className="explorer">
      <div className="explorer-header">
        <span>FILES</span>
        {canEdit && (
          <button className="icon-btn small-icon" onClick={() => setAdding(true)}
                  aria-label="New file" title="New file">+</button>
        )}
      </div>

      {adding && (
        <form onSubmit={submit} className="explorer-new">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            placeholder="name.py"
            aria-label="New file name"
            maxLength={100}
            autoFocus
          />
        </form>
      )}

      <ul className="explorer-list">
        {files.map((f) => (
          <li key={f.id} className={f.id === activeId ? 'file-row active' : 'file-row'}>
            <button className="file-name" onClick={() => onSelect(f.id)}
                    aria-current={f.id === activeId ? 'true' : undefined}>
              {f.name}
            </button>
            {canEdit && (
              <span className="file-actions">
                <button className="icon-btn small-icon" onClick={() => onRename(f)}
                        aria-label={`Rename ${f.name}`} title="Rename">✎</button>
                <button className="icon-btn small-icon" onClick={() => onDelete(f)}
                        aria-label={`Delete ${f.name}`} title="Delete">✕</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
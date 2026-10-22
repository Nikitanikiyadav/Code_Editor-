import { useCallback, useEffect, useState } from 'react'
import useAuth from '../../hooks/useAuth'
import usePresence from '../../hooks/usePresence'
import useToast from '../../hooks/useToast'
import { getErrorMessages } from '../../services/errors'
import { createFile, deleteFile, listFiles, updateFile } from '../../services/files'
import { colorFor } from '../../utils/collab'
import '../../styles/ide.css'
import EditorPane from './EditorPane'
import FileExplorer from './FileExplorer'
import OutputPanel from './OutputPanel'

const byName = (a, b) => a.name.localeCompare(b.name)

function readTheme() {
  try {
    return localStorage.getItem('codearena-theme') || 'dark'
  } catch {
    return 'dark'
  }
}

export default function IdeLayout({ room }) {
  const toast = useToast()
  const { user } = useAuth()
  const canEdit = room.role !== 'viewer'
  const presence = usePresence(user, toast)

  const [files, setFiles] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [explorerWidth, setExplorerWidth] = useState(220)
  const [showOutput, setShowOutput] = useState(true)

  useEffect(() => {
    let ignore = false
    listFiles(room.code)
      .then((data) => {
        if (ignore) return
        setFiles(data)
        setActiveId(data[0]?.id ?? null)
      })
      .catch(() => !ignore && setError('Could not load the files of this room.'))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [room.code])

  // Someone created, renamed or deleted a file: reload the list
  const refreshFiles = useCallback(async () => {
    try {
      const data = await listFiles(room.code)
      setFiles(data)
      // If my open file was deleted, move to the first remaining one
      setActiveId((current) =>
        data.some((f) => f.id === current) ? current : (data[0]?.id ?? null),
      )
    } catch {
      /* ignore: the next event will retry */
    }
  }, [room.code])

  useEffect(() => {
    if (!dirty) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('codearena-theme', next)
    } catch {
      /* ignore */
    }
  }

  const selectFile = (id) => {
    if (id === activeId) return
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    setDirty(false)
    setActiveId(id)
  }

  const handleFileChanged = useCallback(
    (updated) =>
      setFiles((list) =>
        list.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)).sort(byName),
      ),
    [],
  )

  const handleCreate = async (name) => {
    try {
      const file = await createFile(room.code, { name })
      setFiles((list) => [...list, file].sort(byName))
      selectFile(file.id)
      return true
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
      return false
    }
  }

  const handleRename = async (file) => {
    const name = window.prompt('New file name:', file.name)
    if (!name || name.trim() === file.name) return
    try {
      handleFileChanged(await updateFile(room.code, file.id, { name: name.trim() }))
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    }
  }

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    try {
      await deleteFile(room.code, file.id)
      const remaining = files.filter((f) => f.id !== file.id)
      setFiles(remaining)
      if (file.id === activeId) {
        setDirty(false)
        setActiveId(remaining[0]?.id ?? null)
      }
      toast.success('File deleted.')
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    }
  }

  const startResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = explorerWidth
    const onMove = (ev) =>
      setExplorerWidth(Math.min(400, Math.max(160, startWidth + ev.clientX - startX)))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resizeByKey = (e) => {
    if (e.key === 'ArrowLeft') setExplorerWidth((w) => Math.max(160, w - 20))
    if (e.key === 'ArrowRight') setExplorerWidth((w) => Math.min(400, w + 20))
  }

  const meta = files.find((f) => f.id === activeId)

  if (loading) return <div className={`ide ${theme}`}><p className="muted pad">Loading workspace...</p></div>
  if (error) return <div className={`ide ${theme}`}><p className="error-box pad">{error}</p></div>

  return (
    <div className={`ide ${theme}`}>
      <div className="ide-body">
        <aside className="ide-explorer" style={{ width: explorerWidth }}>
          <FileExplorer
            files={files} activeId={activeId} canEdit={canEdit}
            onSelect={selectFile} onCreate={handleCreate}
            onRename={handleRename} onDelete={handleDelete}
          />

          <div className="presence">
            <div className="explorer-header">
              <span>ONLINE ({presence.users.length})</span>
            </div>
            <ul className="presence-list" aria-label="Online participants">
              {presence.users.map((u) => (
                <li key={u.id}>
                  <span className="avatar" style={{ background: colorFor(u.username) }}
                        aria-hidden="true">
                    {u.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="presence-name">
                    {u.username}{u.you ? ' (you)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div
          className="ide-resizer" role="separator" aria-orientation="vertical"
          aria-label="Resize file explorer (arrow keys)" tabIndex={0}
          onPointerDown={startResize} onKeyDown={resizeByKey}
        />

        <section className="ide-main">
          {meta ? (
            <EditorPane
              key={meta.id}
              roomCode={room.code} meta={meta} canEdit={canEdit}
              theme={theme} showOutput={showOutput}
              onDirtyChange={setDirty} onFileChanged={handleFileChanged}
              onToggleTheme={toggleTheme}
              onToggleOutput={() => setShowOutput((v) => !v)}
              onPresenceEvent={presence.handleEvent}
              onPresenceReset={presence.reset}
              onFilesChanged={refreshFiles}
            />
          ) : (
            <p className="muted pad">No files in this room.</p>
          )}
          {showOutput && <OutputPanel onClose={() => setShowOutput(false)} />}
        </section>
      </div>
    </div>
  )
}
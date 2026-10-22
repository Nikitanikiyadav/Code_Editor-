import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { LANGUAGES } from '../../constants/languages'
import useAuth from '../../hooks/useAuth'
import useToast from '../../hooks/useToast'
import { getErrorMessages } from '../../services/errors'
import { getFile, saveFile, updateFile } from '../../services/files'
import YjsProvider from '../../services/yjsProvider'
import { colorFor, remoteCursorCss } from '../../utils/collab'
import { formatDate } from '../../utils/format'
import VersionsPanel from './VersionsPanel'

const STATUS_LABEL = {
  connecting: 'Connecting...',
  connected: 'Live',
  disconnected: 'Offline, reconnecting...',
  denied: 'No access',
}

export default function EditorPane({
  roomCode, meta, canEdit, theme, showOutput,
  onDirtyChange, onFileChanged, onToggleTheme, onToggleOutput,
  onPresenceEvent, onPresenceReset, onFilesChanged,
}) {
  const toast = useToast()
  const { user } = useAuth()
  const editorRef = useRef(null)
  const providerRef = useRef(null)
  const handlersRef = useRef({}) // always points to the latest callbacks
  const [editor, setEditor] = useState(null)

  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [showVersions, setShowVersions] = useState(false)
  const [status, setStatus] = useState('connecting')
  const [ready, setReady] = useState(false)

  const dirty = ready && content !== savedContent
  const connected = status === 'connected'

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // When this pane disappears (file switched or deleted), the dirty flag must reset
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  useEffect(() => {
    let ignore = false
    getFile(roomCode, meta.id)
      .then((file) => !ignore && setSavedContent(file.content))
      .catch(() => !ignore && setLoadError('Could not load this file.'))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [roomCode, meta.id])

  // Handle JSON events pushed by the server
  const handleText = async (event) => {
    if (event.type === 'saved') {
      try {
        const file = await getFile(roomCode, meta.id)
        setSavedContent(file.content) // everyone's "unsaved" indicator updates
        onFileChanged({
          id: file.id, name: file.name,
          language: file.language, updated_at: file.updated_at,
        })
        if (event.by !== user.username) toast.info(`${event.by} saved this file`)
      } catch {
        /* the next save event will fix it */
      }
    } else if (event.type === 'files_changed') {
      onFilesChanged()
    } else {
      onPresenceEvent(event)
    }
  }

  // Keep the ref current after every render. The provider (created once per file)
  // calls through this ref, so it never uses stale callbacks.
  useEffect(() => {
    handlersRef.current = {
      onText: handleText,
      onOpen: onPresenceReset,
      onClose: onPresenceReset,
    }
  })

  // ---------------- Real-time collaboration ----------------
  useEffect(() => {
    if (!editor) return

    const doc = new Y.Doc()
    const yText = doc.getText('content')
    const awareness = new Awareness(doc)
    awareness.setLocalStateField('user', {
      name: user.username,
      color: colorFor(user.username),
    })

    const style = document.createElement('style')
    document.head.appendChild(style)
    const renderCursors = () => {
      style.textContent = remoteCursorCss(awareness.getStates(), doc.clientID)
    }
    awareness.on('change', renderCursors)

    const provider = new YjsProvider({
      roomCode,
      fileId: meta.id,
      doc,
      awareness,
      onStatus: setStatus,
      onSynced: () => setReady(true),
      onOpen: () => handlersRef.current.onOpen?.(),
      onClose: () => handlersRef.current.onClose?.(),
      onText: (event) => handlersRef.current.onText?.(event),
    })
    providerRef.current = provider

    const binding = new MonacoBinding(yText, editor.getModel(), new Set([editor]), awareness)

    return () => {
      awareness.off('change', renderCursors)
      binding.destroy()
      provider.destroy()
      providerRef.current = null
      awareness.destroy()
      doc.destroy()
      style.remove()
    }
  }, [editor, roomCode, meta.id, user.username])

  const save = useCallback(async () => {
    if (!canEdit || saving || !ready) return
    if (!connected) {
      toast.error('You are offline. Reconnect before saving.')
      return
    }
    if (content === savedContent) {
      toast.info('No changes to save.')
      return
    }
    setSaving(true)
    try {
      const saved = await saveFile(roomCode, meta.id, content)
      setSavedContent(saved.content)
      onFileChanged({
        id: saved.id, name: saved.name,
        language: saved.language, updated_at: saved.updated_at,
      })
      toast.success('Saved')
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    } finally {
      setSaving(false)
    }
  }, [canEdit, saving, ready, connected, content, savedContent, roomCode, meta.id, onFileChanged, toast])

  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const handleMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => saveRef.current(),
    )
    editorInstance.onDidChangeCursorPosition((e) =>
      setCursor({ line: e.position.lineNumber, column: e.position.column }),
    )
    setEditor(editorInstance)
    editorInstance.focus()
  }

  const changeLanguage = async (language) => {
    try {
      onFileChanged(await updateFile(roomCode, meta.id, { language }))
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    }
  }

  const format = () => {
    const action = editorRef.current?.getAction('editor.action.formatDocument')
    if (!action) {
      toast.info('Formatting is not available for this language.')
      return
    }
    action.run()
  }

  const loadVersion = (text) => {
    const ed = editorRef.current
    const model = ed?.getModel()
    if (!model) return
    ed.executeEdits('restore-version', [{ range: model.getFullModelRange(), text }])
    setShowVersions(false)
    toast.info('Version loaded for everyone in the room. Press Save to keep it.')
  }

  if (loading) return <div className="editor-pane"><p className="muted pad">Loading file...</p></div>
  if (loadError) return <div className="editor-pane"><p className="error-box pad">{loadError}</p></div>

  return (
    <div className="editor-pane">
      <div className="editor-toolbar">
        <div className="editor-tab">
          <span>{meta.name}</span>
          {dirty && <span className="dirty-dot" title="Unsaved changes" aria-label="Unsaved changes">●</span>}
          <span className={`conn conn-${status}`} role="status">
            ● {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="toolbar-group">
          <select value={meta.language} onChange={(e) => changeLanguage(e.target.value)}
                  disabled={!canEdit} aria-label="Editor language">
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                  aria-label="Decrease font size">A−</button>
          <button className="btn btn-secondary" onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                  aria-label="Increase font size">A+</button>
          <button className="btn btn-secondary" onClick={format} disabled={!canEdit}>Format</button>
          <button className="btn btn-secondary" onClick={() => setShowVersions(true)}>History</button>
          <button className="btn btn-secondary" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="btn btn-secondary" onClick={onToggleOutput}>
            {showOutput ? 'Hide output' : 'Output'}
          </button>
          <button className="btn btn-secondary" disabled
                  title="Code execution is disabled: it needs a secure sandbox">▶ Run</button>
          <button className="btn btn-primary" onClick={save}
                  disabled={!canEdit || saving || !ready || !connected}
                  title="Save (Ctrl+S)">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {status === 'disconnected' && (
        <div className="banner banner-warn" role="alert">
          <span>
            You're offline. Keep typing: your edits stay in this tab and sync
            automatically when the connection returns. Don't close the tab before then.
          </span>
          <button className="btn btn-secondary" onClick={() => providerRef.current?.reconnectNow()}>
            Retry now
          </button>
        </div>
      )}
      {status === 'denied' && (
        <div className="banner banner-error" role="alert">
          <span>You no longer have access to this file (removed, deleted, or logged out).</span>
          <a className="btn btn-secondary" href="/dashboard">Back to dashboard</a>
        </div>
      )}

      <div className="editor-surface">
        <Editor
          height="100%"
          language={meta.language}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onChange={(value) => setContent(value ?? '')}
          onMount={handleMount}
          loading={<p className="muted pad">Loading editor...</p>}
          options={{
            fontSize,
            readOnly: !canEdit || !ready || status === 'denied',
            lineNumbers: 'on',
            autoIndent: 'full',
            tabSize: 4,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
          }}
        />
      </div>

      <div className="statusbar">
        <span className={dirty ? 'status-dirty' : ''}>
          {!canEdit
            ? 'Read-only (viewer)'
            : status === 'denied'
              ? 'No access'
              : !ready
                ? 'Syncing...'
                : dirty
                  ? '● Unsaved changes (shared with the room)'
                  : `✓ All changes saved · ${formatDate(meta.updated_at)}`}
        </span>
        <span>Ln {cursor.line}, Col {cursor.column}</span>
      </div>

      {showVersions && (
        <VersionsPanel roomCode={roomCode} fileId={meta.id} canEdit={canEdit}
                       onLoad={loadVersion} onClose={() => setShowVersions(false)} />
      )}
    </div>
  )
}
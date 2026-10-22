import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { LANGUAGES } from '../../constants/languages'
import useToast from '../../hooks/useToast'
import { getErrorMessages } from '../../services/errors'
import { getFile, saveFile, updateFile } from '../../services/files'
import { formatDate } from '../../utils/format'
import VersionsPanel from './VersionsPanel'

export default function EditorPane({
  roomCode, meta, canEdit, theme, showOutput,
  onDirtyChange, onFileChanged, onToggleTheme, onToggleOutput,
}) {
  const toast = useToast()
  const editorRef = useRef(null)

  const [content, setContent] = useState('')        // what is in the editor now
  const [savedContent, setSavedContent] = useState('') // what the server has
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [showVersions, setShowVersions] = useState(false)

  // The unsaved-changes indicator: just compare the two strings
  const dirty = content !== savedContent

  // Tell the parent, so it can warn before switching files or closing the tab
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Load the file content from the server when this pane appears
  useEffect(() => {
    let ignore = false
    getFile(roomCode, meta.id)
      .then((file) => {
        if (ignore) return
        setContent(file.content)
        setSavedContent(file.content)
      })
      .catch(() => !ignore && setLoadError('Could not load this file.'))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [roomCode, meta.id])

  const save = useCallback(async () => {
    if (!canEdit || saving) return
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
  }, [canEdit, saving, content, savedContent, roomCode, meta.id, onFileChanged, toast])

  // Monaco registers the Ctrl+S shortcut only once, at mount time. A ref always
  // points to the latest save(), so the shortcut never uses stale content.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const handleMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current())
    editor.onDidChangeCursorPosition((e) =>
      setCursor({ line: e.position.lineNumber, column: e.position.column }),
    )
    editor.focus()
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
    // Monaco has built-in formatters for JavaScript, TypeScript, HTML, CSS and JSON only
  }

  const loadVersion = (text) => {
    setContent(text)
    setShowVersions(false)
    toast.info('Version loaded into the editor. Press Save to keep it.')
  }

  if (loading) return <div className="editor-pane"><p className="muted pad">Loading file...</p></div>
  if (loadError) return <div className="editor-pane"><p className="error-box pad">{loadError}</p></div>

  return (
    <div className="editor-pane">
      <div className="editor-toolbar">
        <div className="editor-tab">
          <span>{meta.name}</span>
          {dirty && <span className="dirty-dot" title="Unsaved changes" aria-label="Unsaved changes">●</span>}
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
          <button className="btn btn-primary" onClick={save} disabled={!canEdit || saving}
                  title="Save (Ctrl+S)">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-surface">
        <Editor
          height="100%"
          language={meta.language}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={content}
          onChange={(value) => setContent(value ?? '')}
          onMount={handleMount}
          loading={<p className="muted pad">Loading editor...</p>}
          options={{
            fontSize,
            readOnly: !canEdit,
            lineNumbers: 'on',
            autoIndent: 'full',
            tabSize: 4,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true, // re-fit when the panel is resized
            wordWrap: 'on',
          }}
        />
      </div>

      <div className="statusbar">
        <span className={dirty ? 'status-dirty' : ''}>
          {!canEdit
            ? 'Read-only (viewer)'
            : dirty
              ? '● Unsaved changes'
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
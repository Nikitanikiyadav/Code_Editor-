import { useEffect, useState } from 'react'
import useToast from '../../hooks/useToast'
import { getErrorMessages } from '../../services/errors'
import { getVersion, listVersions } from '../../services/files'
import { formatDate } from '../../utils/format'
import Modal from '../Modal'

export default function VersionsPanel({ roomCode, fileId, canEdit, onLoad, onClose }) {
  const toast = useToast()
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    listVersions(roomCode, fileId)
      .then((data) => !ignore && setVersions(data))
      .catch(() => !ignore && toast.error('Could not load version history.'))
      .finally(() => !ignore && setLoading(false))
    return () => {
      ignore = true
    }
  }, [roomCode, fileId, toast])

  const handleLoad = async (versionId) => {
    try {
      const version = await getVersion(roomCode, fileId, versionId)
      onLoad(version.content)
    } catch (err) {
      toast.error(getErrorMessages(err)[0])
    }
  }

  return (
    <Modal title="Version history" onClose={onClose}>
      {loading && <p className="muted">Loading...</p>}
      {!loading && versions.length === 0 && (
        <p className="muted">No saved versions yet. Press Save to create one.</p>
      )}
      <ul className="version-list">
        {versions.map((v) => (
          <li key={v.id}>
            <div>
              <strong>{formatDate(v.created_at)}</strong>
              <p className="muted small">
                {v.saved_by} · {v.size} characters
              </p>
            </div>
            {canEdit && (
              <button className="btn btn-secondary" onClick={() => handleLoad(v.id)}>
                Load
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
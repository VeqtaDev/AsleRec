import { useMemo, useState } from 'react'

import type { Recording } from '@shared/types'

import {
  IconFolder,
  IconLibrary,
  IconPlay,
  IconRegion,
  IconScissors,
  IconTrash
} from '../components/icons'
import { Button, EmptyState, IconButton, Sheet } from '../components/ui'
import { formatBytes, formatDuration, formatResolution, formatWhen } from '../lib/format'
import { useApp } from '../state/app'

const api = window.aslerec

export function LibraryPage(): JSX.Element {
  const { recordings, openEditor, setPage, pushToast, refreshLibrary } = useApp()
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Recording | null>(null)
  const [renaming, setRenaming] = useState<Recording | null>(null)
  const [draftName, setDraftName] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return recordings
    return recordings.filter((item) => item.fileName.toLowerCase().includes(needle))
  }, [recordings, query])

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return
    await api.library.delete(pendingDelete.id)
    pushToast({ tone: 'neutral', title: 'Enregistrement supprimé' })
    setPendingDelete(null)
    await refreshLibrary()
  }

  const confirmRename = async (): Promise<void> => {
    if (!renaming) return
    await api.library.rename(renaming.id, draftName)
    setRenaming(null)
    await refreshLibrary()
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Bibliothèque</h1>
          <p>
            {recordings.length === 0
              ? 'Aucun enregistrement pour le moment.'
              : `${recordings.length} enregistrement${recordings.length > 1 ? 's' : ''}`}
          </p>
        </div>
        {recordings.length > 0 && (
          <input
            className="search"
            type="search"
            placeholder="Rechercher…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </header>

      {recordings.length === 0 ? (
        <EmptyState
          icon={<IconLibrary size={30} />}
          title="Rien à afficher"
          description="Vos enregistrements apparaîtront ici dès la première capture."
          action={
            <Button variant="primary" onClick={() => setPage('capture')} icon={<IconRegion size={16} />}>
              Enregistrer maintenant
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconLibrary size={30} />}
          title="Aucun résultat"
          description={`Rien ne correspond à « ${query} ».`}
        />
      ) : (
        <div className="library-grid">
          {filtered.map((item) => (
            <article key={item.id} className="rec-card">
              <button
                type="button"
                className="rec-card__preview"
                onClick={() => openEditor(item.id)}
                title="Ouvrir dans l'éditeur"
              >
                {item.thumbnailPath ? (
                  <img src={api.library.fileUrl(item.thumbnailPath)} alt="" loading="lazy" />
                ) : (
                  <span className="rec-card__placeholder">
                    <IconLibrary size={26} />
                  </span>
                )}
                <span className="rec-card__duration">{formatDuration(item.durationMs)}</span>
                <span className="rec-card__hover">
                  <IconScissors size={19} />
                  Éditer
                </span>
              </button>

              <div className="rec-card__body">
                <button
                  type="button"
                  className="rec-card__name"
                  title="Renommer"
                  onClick={() => {
                    setRenaming(item)
                    setDraftName(item.fileName.replace(/\.[^.]+$/, ''))
                  }}
                >
                  {item.fileName.replace(/\.[^.]+$/, '')}
                </button>
                <p className="rec-card__meta">
                  {formatWhen(item.createdAt)} · {formatResolution(item.width, item.height)} ·{' '}
                  {formatBytes(item.sizeBytes)}
                  {item.hasAudio ? ' · audio' : ''}
                </p>
              </div>

              <div className="rec-card__actions">
                <IconButton
                  label="Lire dans le lecteur Windows"
                  onClick={() => void api.library.open(item.filePath)}
                >
                  <IconPlay size={16} />
                </IconButton>
                <IconButton
                  label="Afficher dans l'explorateur"
                  onClick={() => void api.library.reveal(item.filePath)}
                >
                  <IconFolder size={17} />
                </IconButton>
                <IconButton
                  label="Supprimer"
                  tone="danger"
                  onClick={() => setPendingDelete(item)}
                >
                  <IconTrash size={17} />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet
        open={Boolean(pendingDelete)}
        title="Supprimer l'enregistrement ?"
        description={`« ${pendingDelete?.fileName ?? ''} » sera définitivement effacé du disque.`}
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Supprimer
            </Button>
          </>
        }
      >
        <p className="sheet__note">Cette action est irréversible.</p>
      </Sheet>

      <Sheet
        open={Boolean(renaming)}
        title="Renommer"
        onClose={() => setRenaming(null)}
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Annuler</Button>
            <Button variant="primary" onClick={() => void confirmRename()}>
              Enregistrer
            </Button>
          </>
        }
      >
        <input
          className="text-field"
          value={draftName}
          autoFocus
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void confirmRename()
          }}
        />
      </Sheet>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  RESOLUTIONS,
  type AudioExportFormat,
  type MediaInfo,
  type Rect,
  type Resolution
} from '@shared/types'

import { CropBox } from '../components/CropBox'
import { Timeline } from '../components/Timeline'
import {
  IconChevronLeft,
  IconCrop,
  IconFolder,
  IconPause,
  IconPlay,
  IconScissors,
  IconWave
} from '../components/icons'
import { Badge, Button, Group, IconButton, Row, Segmented, Select, Sheet, Toggle } from '../components/ui'
import { formatBytes, formatPrecise, formatResolution } from '../lib/format'
import { useApp } from '../state/app'

const api = window.aslerec

export function EditorPage({ recordingId }: { recordingId: string }): JSX.Element {
  const { recordings, closeEditor, pushToast, refreshLibrary } = useApp()
  const recording = recordings.find((item) => item.id === recordingId)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [version, setVersion] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [loop, setLoop] = useState(true)
  const [cropEnabled, setCropEnabled] = useState(false)
  const [crop, setCrop] = useState<Rect | null>(null)
  const [targetHeight, setTargetHeight] = useState<Resolution | 'source'>('source')
  const [audioSheet, setAudioSheet] = useState(false)
  const [audioFormat, setAudioFormat] = useState<AudioExportFormat>('mp3')
  const [audioScope, setAudioScope] = useState<'selection' | 'full'>('selection')
  const [busy, setBusy] = useState(false)
  /** Vrai pendant qu'un travail FFmpeg doit avoir la main libre sur le fichier. */
  const [detached, setDetached] = useState(false)

  const source = useMemo(
    () => (recording ? `${api.library.fileUrl(recording.filePath)}&v=${version}` : ''),
    [recording, version]
  )

  /* Métadonnées ------------------------------------------------------- */

  useEffect(() => {
    if (!recording) return
    let cancelled = false
    void api.editor.probe(recording.filePath).then((next) => {
      if (cancelled) return
      setInfo(next)
      setSelection({ start: 0, end: next.durationSec })
      setCrop({ x: 0, y: 0, width: next.width, height: next.height })
    })
    return () => {
      cancelled = true
    }
  }, [recording, version])

  /* Lecture ----------------------------------------------------------- */

  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = (): void => {
      setCurrentTime(video.currentTime)
      // La lecture reste confinée à la sélection : on voit exactement ce qui sera exporté.
      if (video.currentTime >= selection.end - 0.02) {
        if (loop) {
          video.currentTime = selection.start
        } else {
          video.pause()
        }
      }
    }
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [loop, selection.end, selection.start])

  const togglePlay = (): void => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.currentTime < selection.start || video.currentTime >= selection.end - 0.02) {
        video.currentTime = selection.start
      }
      void video.play()
    } else {
      video.pause()
    }
  }

  /* Raccourcis clavier ------------------------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (event.key === ' ') {
        event.preventDefault()
        togglePlay()
      }
      if (event.key === 'i') setSelection((current) => ({ ...current, start: currentTime }))
      if (event.key === 'o') setSelection((current) => ({ ...current, end: currentTime }))
      if (event.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (!recording) {
    return (
      <div className="page">
        <p className="editor-missing">Cet enregistrement n&apos;est plus disponible.</p>
        <Button onClick={closeEditor}>Retour à la bibliothèque</Button>
      </div>
    )
  }

  /* Exports ----------------------------------------------------------- */

  const effectiveCrop = (): Rect | null => {
    if (!cropEnabled || !crop || !info) return null
    const full =
      crop.x <= 1 && crop.y <= 1 && crop.width >= info.width - 1 && crop.height >= info.height - 1
    return full ? null : crop
  }

  const runTrim = async (mode: 'replace' | 'copy'): Promise<void> => {
    setBusy(true)
    videoRef.current?.pause()

    // Windows verrouille un fichier ouvert : tant que le lecteur tient la
    // source, FFmpeg ne peut pas la remplacer. On relâche la poignée avant
    // de lancer le travail, et on recharge ensuite.
    if (mode === 'replace' && videoRef.current) {
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
      setDetached(true)
      await new Promise((resolve) => setTimeout(resolve, 150))
    }

    const result = await api.editor.trim({
      sourcePath: recording.filePath,
      startSec: selection.start,
      endSec: selection.end,
      crop: effectiveCrop(),
      targetHeight: targetHeight === 'source' ? null : targetHeight,
      mode,
      outputName:
        mode === 'copy'
          ? `${recording.fileName.replace(/\.[^.]+$/, '')} - extrait`
          : undefined
    })
    setBusy(false)
    setDetached(false)

    if (result.error) {
      pushToast({ tone: 'danger', title: "L'export a échoué", detail: result.error })
      if (mode === 'replace') setVersion((value) => value + 1)
      return
    }

    await refreshLibrary()
    if (mode === 'replace') {
      setVersion((value) => value + 1)
      pushToast({ tone: 'success', title: 'Découpage appliqué' })
    } else {
      pushToast({
        tone: 'success',
        title: 'Extrait enregistré',
        detail: result.resultPath?.split(/[\\/]/).pop(),
        action: result.resultPath
          ? { label: 'Afficher', run: () => void api.library.reveal(result.resultPath as string) }
          : undefined
      })
    }
  }

  const runAudioExport = async (): Promise<void> => {
    setBusy(true)
    const result = await api.editor.exportAudio({
      sourcePath: recording.filePath,
      startSec: audioScope === 'full' ? 0 : selection.start,
      endSec: audioScope === 'full' ? (info?.durationSec ?? 0) : selection.end,
      format: audioFormat,
      outputName: `${recording.fileName.replace(/\.[^.]+$/, '')}${audioScope === 'selection' ? ' - extrait' : ''}`
    })
    setBusy(false)
    setAudioSheet(false)

    if (result.error) {
      pushToast({ tone: 'danger', title: "L'export audio a échoué", detail: result.error })
      return
    }
    pushToast({
      tone: 'success',
      title: 'Audio exporté',
      detail: result.resultPath?.split(/[\\/]/).pop(),
      action: result.resultPath
        ? { label: 'Afficher', run: () => void api.library.reveal(result.resultPath as string) }
        : undefined
    })
  }

  const duration = info?.durationSec ?? 0
  const wholeSelected = selection.start <= 0.01 && selection.end >= duration - 0.01
  const hasEdits = !wholeSelected || Boolean(effectiveCrop()) || targetHeight !== 'source'

  return (
    <div className="page page--editor">
      <header className="editor-head">
        <IconButton label="Retour" onClick={closeEditor}>
          <IconChevronLeft size={19} />
        </IconButton>
        <div className="editor-head__text">
          <h1>{recording.fileName.replace(/\.[^.]+$/, '')}</h1>
          <p>
            {formatResolution(recording.width, recording.height)} · {formatBytes(recording.sizeBytes)}
            {info ? ` · ${Math.round(info.fps)} i/s` : ''}
            {recording.hasAudio ? ' · audio' : ' · sans audio'}
          </p>
        </div>
        <Button
          icon={<IconFolder size={16} />}
          onClick={() => void api.library.reveal(recording.filePath)}
        >
          Dossier
        </Button>
      </header>

      <div className="editor-stage">
        <div className="editor-video">
          <video
            ref={videoRef}
            src={detached ? undefined : source}
            preload="metadata"
            playsInline
          />
          {detached && (
            <div className="editor-video__busy">
              <span className="notice__spinner" />
              Traitement en cours…
            </div>
          )}
          {cropEnabled && crop && info && (
            <CropBox
              value={crop}
              onChange={setCrop}
              sourceWidth={info.width}
              sourceHeight={info.height}
            />
          )}
        </div>

        <div className="editor-transport">
          <IconButton label={playing ? 'Pause' : 'Lecture'} onClick={togglePlay}>
            {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
          </IconButton>
          <span className="editor-time">
            {formatPrecise(currentTime)} <em>/ {formatPrecise(duration)}</em>
          </span>
          <div className="editor-transport__spacer" />
          <button
            type="button"
            className="chip"
            onClick={() => setSelection((current) => ({ ...current, start: currentTime }))}
            title="Placer le début ici (I)"
          >
            Début ici
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => setSelection((current) => ({ ...current, end: currentTime }))}
            title="Placer la fin ici (O)"
          >
            Fin ici
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => setSelection({ start: 0, end: duration })}
          >
            Tout
          </button>
          <label className="chip chip--toggle">
            <input
              type="checkbox"
              checked={loop}
              onChange={(event) => setLoop(event.target.checked)}
            />
            Boucle
          </label>
        </div>

        <Timeline
          duration={duration}
          currentTime={currentTime}
          selection={selection}
          onSelectionChange={setSelection}
          onSeek={seek}
        />
      </div>

      <div className="editor-panels">
        <Group title="Ajustements">
          <Row
            icon={<IconCrop size={18} />}
            label="Recadrer"
            description={
              cropEnabled && crop
                ? `${Math.round(crop.width)} × ${Math.round(crop.height)} px`
                : "Garder l'image entière"
            }
          >
            <Toggle checked={cropEnabled} onChange={setCropEnabled} label="Recadrer" />
          </Row>
          {cropEnabled && info && (
            <Row label="Réinitialiser le cadre">
              <Button
                onClick={() => setCrop({ x: 0, y: 0, width: info.width, height: info.height })}
              >
                Tout l&apos;écran
              </Button>
            </Row>
          )}
          <Row label="Définition d'export">
            <Select<string>
              value={String(targetHeight)}
              options={[
                { value: 'source', label: `Identique (${recording.height}p)` },
                ...RESOLUTIONS.filter((value) => value <= recording.height || value === 720).map(
                  (value) => ({ value: String(value), label: `${value}p` })
                )
              ]}
              onChange={(value) =>
                setTargetHeight(value === 'source' ? 'source' : (Number(value) as Resolution))
              }
            />
          </Row>
        </Group>

        <Group
          title="Exporter"
          footnote="Les fichiers créés arrivent dans votre dossier d'enregistrements."
        >
          <Row
            icon={<IconScissors size={18} />}
            label="Enregistrer l'extrait à part"
            description="Crée un nouveau fichier sans toucher à l'original."
          >
            <Button
              variant="primary"
              disabled={busy || duration === 0}
              onClick={() => void runTrim('copy')}
            >
              Exporter
            </Button>
          </Row>

          <Row
            icon={<IconScissors size={18} />}
            label="Appliquer au fichier d'origine"
            description="Remplace l'enregistrement par la sélection."
          >
            <Button
              variant="danger"
              disabled={busy || !hasEdits}
              onClick={() => void runTrim('replace')}
            >
              Appliquer
            </Button>
          </Row>

          <Row
            icon={<IconWave size={18} />}
            label="Extraire le son"
            description="MP3, WAV ou M4A, sur la sélection ou la totalité."
          >
            <Button disabled={busy || !recording.hasAudio} onClick={() => setAudioSheet(true)}>
              Exporter l&apos;audio
            </Button>
          </Row>
        </Group>

        {!recording.hasAudio && (
          <p className="editor-note">
            <Badge>Info</Badge> Cet enregistrement ne contient pas de piste audio.
          </p>
        )}
      </div>

      <Sheet
        open={audioSheet}
        title="Extraire le son"
        description="Choisissez la portion et le format du fichier audio."
        onClose={() => setAudioSheet(false)}
        footer={
          <>
            <Button onClick={() => setAudioSheet(false)}>Annuler</Button>
            <Button variant="primary" disabled={busy} onClick={() => void runAudioExport()}>
              Exporter
            </Button>
          </>
        }
      >
        <Row label="Portion">
          <Segmented<'selection' | 'full'>
            value={audioScope}
            options={[
              { value: 'selection', label: 'Sélection' },
              { value: 'full', label: 'Tout' }
            ]}
            onChange={setAudioScope}
          />
        </Row>
        <Row label="Format">
          <Segmented<AudioExportFormat>
            value={audioFormat}
            options={[
              { value: 'mp3', label: 'MP3' },
              { value: 'm4a', label: 'M4A' },
              { value: 'wav', label: 'WAV' }
            ]}
            onChange={setAudioFormat}
          />
        </Row>
        <p className="sheet__note">
          Durée exportée :{' '}
          {formatPrecise(
            audioScope === 'full' ? duration : Math.max(0, selection.end - selection.start)
          )}
        </p>
      </Sheet>
    </div>
  )
}

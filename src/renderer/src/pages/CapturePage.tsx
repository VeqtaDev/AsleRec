import { FPS_OPTIONS, RESOLUTIONS, type Fps, type Resolution } from '@shared/types'

import {
  IconFolder,
  IconFullscreen,
  IconMic,
  IconPause,
  IconPlay,
  IconRegion,
  IconSpeaker,
  IconStop
} from '../components/icons'
import { Button, Group, Kbd, Row, Segmented, Select, Slider, Toggle } from '../components/ui'
import { formatAccelerator, formatTimer } from '../lib/format'
import { useApp } from '../state/app'

const api = window.aslerec

const QUALITY_HINTS: Record<Resolution, string> = {
  240: 'léger',
  480: 'compact',
  720: 'conseillé',
  1080: 'net'
}

export function CapturePage(): JSX.Element {
  const { settings, updateSettings, status, microphones, pushToast } = useApp()
  if (!settings) return <></>

  const recording = status.state === 'recording' || status.state === 'paused'
  const preparing = status.state === 'countdown' || status.state === 'processing'

  const start = async (mode: 'region' | 'fullscreen'): Promise<void> => {
    if (recording || preparing) return
    if (mode === 'region') await api.recording.startRegion()
    else await api.recording.startFullscreen()
  }

  const chooseFolder = async (): Promise<void> => {
    const folder = await api.settings.chooseOutputFolder()
    if (!folder) return
    await updateSettings({ outputFolder: folder })
    pushToast({ tone: 'success', title: 'Dossier mis à jour', detail: folder })
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Enregistrer</h1>
          <p>Choisissez une zone ou capturez l&apos;écran entier.</p>
        </div>
      </header>

      {recording ? (
        <LivePanel />
      ) : (
        <div className="capture-grid">
          <button
            type="button"
            className="capture-card capture-card--primary"
            onClick={() => void start('region')}
            disabled={preparing}
          >
            <span className="capture-card__glow" aria-hidden="true" />
            <span className="capture-card__icon">
              <IconRegion size={26} />
            </span>
            <span className="capture-card__title">Zone sélectionnée</span>
            <span className="capture-card__text">
              Tracez le rectangle à filmer, comme une capture d&apos;écran.
            </span>
            <Kbd combo={formatAccelerator(settings.hotkeys.region)} />
          </button>

          <button
            type="button"
            className="capture-card"
            onClick={() => void start('fullscreen')}
            disabled={preparing}
          >
            <span className="capture-card__icon">
              <IconFullscreen size={26} />
            </span>
            <span className="capture-card__title">Écran entier</span>
            <span className="capture-card__text">
              Filme l&apos;écran où se trouve le curseur, sans étape intermédiaire.
            </span>
            <Kbd combo={formatAccelerator(settings.hotkeys.fullscreen)} />
          </button>
        </div>
      )}

      {status.state === 'countdown' && (
        <div className="notice notice--red">
          <span className="notice__dot" />
          Préparation de l&apos;enregistrement…
        </div>
      )}

      {status.state === 'processing' && (
        <div className="notice">
          <span className="notice__spinner" />
          Finalisation du fichier — {Math.round((status.progress ?? 0) * 100)} %
        </div>
      )}

      <Group title="Qualité">
        <Row label="Définition" description="Plafond appliqué à la vidéo exportée.">
          <Segmented<Resolution>
            value={settings.quality}
            options={RESOLUTIONS.map((value) => ({
              value,
              label: `${value}p`,
              hint: QUALITY_HINTS[value]
            }))}
            onChange={(quality) => void updateSettings({ quality })}
            size="lg"
          />
        </Row>
        <Row label="Fluidité" description="Images par seconde capturées.">
          <Segmented<Fps>
            value={settings.fps}
            options={FPS_OPTIONS.map((value) => ({ value, label: `${value} i/s` }))}
            onChange={(fps) => void updateSettings({ fps })}
          />
        </Row>
      </Group>

      <Group title="Audio" footnote="Les deux sources sont mixées dans une piste unique.">
        <Row
          icon={<IconSpeaker size={18} />}
          label="Son de l'ordinateur"
          description="Tout ce qui sort des haut-parleurs."
        >
          <Toggle
            checked={settings.captureSystemAudio}
            onChange={(captureSystemAudio) => void updateSettings({ captureSystemAudio })}
            label="Son de l'ordinateur"
          />
        </Row>
        {settings.captureSystemAudio && (
          <Row label="Volume du son PC">
            <Slider
              value={settings.systemGain}
              min={0}
              max={2}
              step={0.05}
              onChange={(systemGain) => void updateSettings({ systemGain })}
              format={(value) => `${Math.round(value * 100)} %`}
            />
          </Row>
        )}

        <Row
          icon={<IconMic size={18} />}
          label="Microphone"
          description="Pour commenter pendant l'enregistrement."
        >
          <Toggle
            checked={settings.captureMicrophone}
            onChange={(captureMicrophone) => void updateSettings({ captureMicrophone })}
            label="Microphone"
          />
        </Row>
        {settings.captureMicrophone && (
          <>
            <Row label="Appareil">
              <Select
                value={settings.microphoneDeviceId ?? 'default'}
                options={
                  microphones.length
                    ? microphones.map((device) => ({
                        value: device.deviceId || 'default',
                        label: device.label
                      }))
                    : [{ value: 'default', label: 'Micro par défaut' }]
                }
                onChange={(microphoneDeviceId) =>
                  void updateSettings({
                    microphoneDeviceId:
                      microphoneDeviceId === 'default' ? null : microphoneDeviceId
                  })
                }
              />
            </Row>
            <Row label="Volume du micro">
              <Slider
                value={settings.micGain}
                min={0}
                max={2}
                step={0.05}
                onChange={(micGain) => void updateSettings({ micGain })}
                format={(value) => `${Math.round(value * 100)} %`}
              />
            </Row>
          </>
        )}
      </Group>

      <Group title="Destination">
        <Row
          icon={<IconFolder size={18} />}
          label="Dossier des enregistrements"
          description={settings.outputFolder}
        >
          <Button onClick={() => void chooseFolder()}>Modifier</Button>
        </Row>
      </Group>
    </div>
  )
}

/** Panneau affiché à la place des cartes pendant un enregistrement. */
function LivePanel(): JSX.Element {
  const { status } = useApp()
  const paused = status.state === 'paused'

  return (
    <div className={`live-panel ${paused ? 'live-panel--paused' : ''}`}>
      <div className="live-panel__left">
        <span className={`live-dot live-dot--lg ${paused ? 'live-dot--paused' : ''}`} />
        <div>
          <span className="live-panel__state">
            {paused ? 'Enregistrement en pause' : 'Enregistrement en cours'}
          </span>
          <span className="live-panel__mode">
            {status.mode === 'region' ? 'Zone sélectionnée' : 'Écran entier'}
          </span>
        </div>
      </div>

      <span className="live-panel__timer">{formatTimer(status.elapsedMs)}</span>

      <div className="live-panel__actions">
        <Button
          onClick={() => void api.recording.togglePause()}
          icon={paused ? <IconPlay size={16} /> : <IconPause size={16} />}
        >
          {paused ? 'Reprendre' : 'Pause'}
        </Button>
        <Button
          variant="primary"
          onClick={() => void api.recording.stop()}
          icon={<IconStop size={15} />}
        >
          Arrêter
        </Button>
      </div>
    </div>
  )
}

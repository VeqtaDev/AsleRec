import { useEffect, useState } from 'react'

import {
  FPS_OPTIONS,
  RESOLUTIONS,
  type Fps,
  type Hotkeys,
  type OutputFormat,
  type Resolution
} from '@shared/types'

import { HotkeyField } from '../components/HotkeyField'
import { IconFolder, IconKeyboard, IconMic, IconSparkle, IconSpeaker } from '../components/icons'
import { Button, Group, Row, Segmented, Select, Slider, Toggle } from '../components/ui'
import { useApp } from '../state/app'

const api = window.aslerec

const HOTKEY_LABELS: { key: keyof Hotkeys; label: string; description: string }[] = [
  { key: 'region', label: 'Enregistrer une zone', description: 'Ouvre le sélecteur de zone.' },
  { key: 'fullscreen', label: "Enregistrer l'écran", description: 'Démarre sans sélection.' },
  { key: 'stop', label: 'Arrêter', description: "Termine et enregistre le fichier." },
  { key: 'pause', label: 'Pause / reprise', description: "Suspend sans couper l'enregistrement." }
]

export function SettingsPage(): JSX.Element {
  const { settings, updateSettings, microphones, pushToast } = useApp()
  const [version, setVersion] = useState('')

  useEffect(() => {
    void api.system.getVersion().then(setVersion)
  }, [])

  if (!settings) return <></>

  const chooseFolder = async (): Promise<void> => {
    const folder = await api.settings.chooseOutputFolder()
    if (!folder) return
    await updateSettings({ outputFolder: folder })
    pushToast({ tone: 'success', title: 'Dossier mis à jour', detail: folder })
  }

  const setHotkey = (key: keyof Hotkeys) => (accelerator: string) => {
    void updateSettings({ hotkeys: { ...settings.hotkeys, [key]: accelerator } })
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Réglages</h1>
          <p>AsleRec {version && `· version ${version}`}</p>
        </div>
      </header>

      <Group title="Enregistrements">
        <Row
          icon={<IconFolder size={18} />}
          label="Dossier de destination"
          description={settings.outputFolder}
        >
          <Button onClick={() => void chooseFolder()}>Modifier</Button>
        </Row>
        <Row label="Ouvrir le dossier">
          <Button onClick={() => void api.library.reveal(settings.outputFolder)}>Afficher</Button>
        </Row>
        <Row label="Format du fichier" description="MP4 pour la compatibilité maximale.">
          <Segmented<OutputFormat>
            value={settings.outputFormat}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' }
            ]}
            onChange={(outputFormat) => void updateSettings({ outputFormat })}
          />
        </Row>
      </Group>

      <Group title="Qualité par défaut">
        <Row label="Définition">
          <Segmented<Resolution>
            value={settings.quality}
            options={RESOLUTIONS.map((value) => ({ value, label: `${value}p` }))}
            onChange={(quality) => void updateSettings({ quality })}
          />
        </Row>
        <Row label="Fluidité">
          <Segmented<Fps>
            value={settings.fps}
            options={FPS_OPTIONS.map((value) => ({ value, label: `${value} i/s` }))}
            onChange={(fps) => void updateSettings({ fps })}
          />
        </Row>
      </Group>

      <Group title="Audio">
        <Row icon={<IconSpeaker size={18} />} label="Capturer le son de l'ordinateur">
          <Toggle
            checked={settings.captureSystemAudio}
            onChange={(captureSystemAudio) => void updateSettings({ captureSystemAudio })}
            label="Son de l'ordinateur"
          />
        </Row>
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
        <Row icon={<IconMic size={18} />} label="Capturer le microphone">
          <Toggle
            checked={settings.captureMicrophone}
            onChange={(captureMicrophone) => void updateSettings({ captureMicrophone })}
            label="Microphone"
          />
        </Row>
        <Row label="Micro utilisé">
          <Select
            value={settings.microphoneDeviceId ?? 'default'}
            options={
              microphones.length
                ? [
                    { value: 'default', label: 'Micro par défaut' },
                    ...microphones
                      .filter((device) => device.deviceId && device.deviceId !== 'default')
                      .map((device) => ({ value: device.deviceId, label: device.label }))
                  ]
                : [{ value: 'default', label: 'Micro par défaut' }]
            }
            onChange={(microphoneDeviceId) =>
              void updateSettings({
                microphoneDeviceId: microphoneDeviceId === 'default' ? null : microphoneDeviceId
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
      </Group>

      <Group
        title="Raccourcis clavier"
        footnote="Les raccourcis fonctionnent même quand AsleRec est fermé dans la zone de notification."
      >
        {HOTKEY_LABELS.map((item) => (
          <Row
            key={item.key}
            icon={<IconKeyboard size={18} />}
            label={item.label}
            description={item.description}
          >
            <HotkeyField value={settings.hotkeys[item.key]} onChange={setHotkey(item.key)} />
          </Row>
        ))}
      </Group>

      <Group title="Démarrage et confort">
        <Row
          icon={<IconSparkle size={18} />}
          label="Lancer AsleRec au démarrage de Windows"
          description="Les raccourcis sont disponibles dès l'ouverture de session."
        >
          <Toggle
            checked={settings.launchAtStartup}
            onChange={(launchAtStartup) => void updateSettings({ launchAtStartup })}
            label="Démarrage automatique"
          />
        </Row>
        <Row
          label="Démarrer en arrière-plan"
          description="Sans ouvrir la fenêtre, uniquement dans la zone de notification."
        >
          <Toggle
            checked={settings.startMinimized}
            onChange={(startMinimized) => void updateSettings({ startMinimized })}
            disabled={!settings.launchAtStartup}
            label="Démarrer en arrière-plan"
          />
        </Row>
        <Row label="Compte à rebours avant l'enregistrement">
          <Toggle
            checked={settings.showCountdown}
            onChange={(showCountdown) => void updateSettings({ showCountdown })}
            label="Compte à rebours"
          />
        </Row>
        {settings.showCountdown && (
          <Row label="Durée du compte à rebours">
            <Segmented<number>
              value={settings.countdownSeconds}
              options={[
                { value: 1, label: '1 s' },
                { value: 3, label: '3 s' },
                { value: 5, label: '5 s' }
              ]}
              onChange={(countdownSeconds) => void updateSettings({ countdownSeconds })}
            />
          </Row>
        )}
      </Group>

      <Group title="Application">
        <Row label="Quitter AsleRec" description="Ferme aussi l'icône de la zone de notification.">
          <Button variant="danger" onClick={() => void api.system.quit()}>
            Quitter
          </Button>
        </Row>
      </Group>
    </div>
  )
}

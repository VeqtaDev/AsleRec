import { useState } from 'react'

import { RESOLUTIONS, type Resolution } from '@shared/types'

import {
  IconCheck,
  IconFolder,
  IconKeyboard,
  IconMic,
  IconSparkle,
  IconSpeaker
} from '../components/icons'
import { Button, Kbd, Row, Segmented, Toggle } from '../components/ui'
import { formatAccelerator } from '../lib/format'
import { useApp } from '../state/app'

const api = window.aslerec

const STEPS = ['Bienvenue', 'Dossier', 'Réglages'] as const

/**
 * Assistant de premier lancement. Le choix du dossier se fait ici plutôt que
 * dans l'installeur : l'utilisateur voit à quoi il sert, et le réglage reste
 * modifiable ensuite.
 */
export function Onboarding(): JSX.Element {
  const { settings, updateSettings } = useApp()
  const [step, setStep] = useState(0)
  if (!settings) return <></>

  const chooseFolder = async (): Promise<void> => {
    const folder = await api.settings.chooseOutputFolder()
    if (folder) await updateSettings({ outputFolder: folder })
  }

  const finish = (): void => {
    void updateSettings({ onboardingCompleted: true })
  }

  return (
    <div className="onboarding">
      <div className="onboarding__panel">
        <ol className="onboarding__steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={index === step ? 'is-active' : index < step ? 'is-done' : ''}
            >
              <span className="onboarding__bullet">
                {index < step ? <IconCheck size={12} /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="onboarding__body">
            <span className="onboarding__mark">
              <span />
            </span>
            <h1>Bienvenue dans AsleRec</h1>
            <p className="onboarding__lead">
              Enregistrez votre écran en deux touches, avec le son de l&apos;ordinateur et
              votre voix. Découpez, recadrez et exportez sans quitter l&apos;application.
            </p>
            <ul className="onboarding__features">
              <li>
                <IconSparkle size={17} />
                Sélection de zone façon capture d&apos;écran
              </li>
              <li>
                <IconSpeaker size={17} />
                Son du PC et micro mixés automatiquement
              </li>
              <li>
                <IconKeyboard size={17} />
                Raccourcis globaux, même fenêtre fermée
              </li>
            </ul>
          </section>
        )}

        {step === 1 && (
          <section className="onboarding__body">
            <span className="onboarding__icon">
              <IconFolder size={26} />
            </span>
            <h1>Où ranger vos enregistrements ?</h1>
            <p className="onboarding__lead">
              Chaque capture terminée sera écrite automatiquement dans ce dossier.
            </p>
            <div className="onboarding__folder">
              <IconFolder size={18} />
              <span>{settings.outputFolder}</span>
            </div>
            <Button variant="primary" onClick={() => void chooseFolder()}>
              Choisir un autre dossier
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding__body onboarding__body--form">
            <h1>Quelques réglages</h1>
            <p className="onboarding__lead">Tout reste modifiable plus tard.</p>

            <div className="onboarding__rows">
              <Row label="Qualité par défaut">
                <Segmented<Resolution>
                  value={settings.quality}
                  options={RESOLUTIONS.map((value) => ({ value, label: `${value}p` }))}
                  onChange={(quality) => void updateSettings({ quality })}
                />
              </Row>
              <Row icon={<IconSpeaker size={18} />} label="Enregistrer le son de l'ordinateur">
                <Toggle
                  checked={settings.captureSystemAudio}
                  onChange={(captureSystemAudio) => void updateSettings({ captureSystemAudio })}
                  label="Son de l'ordinateur"
                />
              </Row>
              <Row icon={<IconMic size={18} />} label="Enregistrer le microphone">
                <Toggle
                  checked={settings.captureMicrophone}
                  onChange={(captureMicrophone) => void updateSettings({ captureMicrophone })}
                  label="Microphone"
                />
              </Row>
              <Row
                icon={<IconSparkle size={18} />}
                label="Lancer AsleRec au démarrage de Windows"
                description="Recommandé pour garder les raccourcis actifs."
              >
                <Toggle
                  checked={settings.launchAtStartup}
                  onChange={(launchAtStartup) => void updateSettings({ launchAtStartup })}
                  label="Démarrage automatique"
                />
              </Row>
            </div>

            <div className="onboarding__hotkeys">
              <div>
                <span>Zone</span>
                <Kbd combo={formatAccelerator(settings.hotkeys.region)} />
              </div>
              <div>
                <span>Écran entier</span>
                <Kbd combo={formatAccelerator(settings.hotkeys.fullscreen)} />
              </div>
              <div>
                <span>Arrêter</span>
                <Kbd combo={formatAccelerator(settings.hotkeys.stop)} />
              </div>
            </div>
          </section>
        )}

        <footer className="onboarding__foot">
          {step > 0 ? (
            <Button onClick={() => setStep((value) => value - 1)}>Retour</Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" size="lg" onClick={() => setStep((value) => value + 1)}>
              Continuer
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={finish}>
              Commencer
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

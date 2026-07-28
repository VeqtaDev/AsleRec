import { app, net, protocol, session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { registerIpc } from './ipc'
import { library } from './library'
import { installDisplayMediaHandler, recording } from './recording'
import { registerHotkeys, unregisterHotkeys } from './shortcuts'
import { settings } from './settings'
import { createTray, destroyTray } from './tray'
import { createMainWindow, getRecorderWindow, revealMainWindow } from './windows'

const SCHEME = 'aslerec'

// Le protocole doit être déclaré avant `app.whenReady()`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

/* ------------------------------------------------------------------ */
/* Instance unique                                                     */
/* ------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => revealMainWindow('library'))
  void bootstrap()
}

async function bootstrap(): Promise<void> {
  app.setAppUserModelId('dev.veqta.aslerec')

  // La capture d'écran reste fluide même quand la fenêtre est masquée.
  app.commandLine.appendSwitch('disable-background-timer-throttling')

  await app.whenReady()

  registerMediaProtocol()
  grantMediaPermissions()
  installDisplayMediaHandler()
  registerIpc()

  const config = settings().get()
  settings().ensureOutputFolder()

  // Aligne l'état réel du démarrage automatique sur la préférence enregistrée.
  app.setLoginItemSettings({
    openAtLogin: config.launchAtStartup,
    args: config.startMinimized ? ['--hidden'] : []
  })

  registerHotkeys(config.hotkeys)

  try {
    createTray()
  } catch (err) {
    // Sans icône de notification l'application reste utilisable via sa fenêtre.
    console.error('[app] icône de la zone de notification indisponible', err)
  }

  // Le moteur de capture est préchargé pour que le premier raccourci soit instantané.
  getRecorderWindow()

  const launchedHidden =
    process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin
  const showWindow = !launchedHidden || !config.onboardingCompleted
  createMainWindow(showWindow)

  void library().sync(config.outputFolder)

  app.on('activate', () => revealMainWindow())
}

/* ------------------------------------------------------------------ */
/* Accès aux fichiers locaux depuis le renderer                        */
/* ------------------------------------------------------------------ */

/**
 * `aslerec://media/?p=<chemin>` sert les enregistrements et leurs vignettes.
 * L'accès est restreint au dossier de sortie et aux données de l'application :
 * le renderer ne peut pas lire un fichier arbitraire du disque.
 */
function registerMediaProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url)
    const target = url.searchParams.get('p')
    if (!target) return new Response('Chemin manquant', { status: 400 })

    const resolved = path.resolve(target)
    const allowedRoots = [
      path.resolve(settings().get().outputFolder),
      path.resolve(app.getPath('userData'))
    ]
    const allowed = allowedRoots.some((root) => {
      const relative = path.relative(root, resolved)
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    })

    if (!allowed) return new Response('Accès refusé', { status: 403 })
    if (!fs.existsSync(resolved)) return new Response('Introuvable', { status: 404 })

    return net.fetch(pathToFileURL(resolved).toString())
  })
}

/**
 * Autorise micro et capture d'écran pour nos propres fenêtres uniquement.
 * Toute autre permission (notifications, géolocalisation…) est refusée : AsleRec
 * ne charge que du contenu local et n'en a jamais besoin.
 */
function grantMediaPermissions(): void {
  const allowed = new Set(['media', 'display-capture'])

  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(allowed.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => {
    return allowed.has(permission)
  })
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

// AsleRec vit dans la zone de notification : fermer la fenêtre ne quitte pas.
app.on('window-all-closed', () => {
  /* volontairement vide */
})

app.on('before-quit', () => {
  unregisterHotkeys()
  destroyTray()
  void recording().cancel()
})

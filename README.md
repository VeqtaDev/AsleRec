<div align="center">

# AsleRec

**Enregistreur d'écran pour Windows — simple, rapide, propre.**

Sélection de zone façon `Maj + Win + S`, audio du PC et micro, découpe et
recadrage intégrés, export audio. Le tout dans une interface sombre inspirée
d'iOS, en rouge, noir et blanc.

**[📖 Documentation](https://veqtadev.github.io/AsleRec/)** ·
**[⬇️ Télécharger l'installeur](https://github.com/VeqtaDev/AsleRec/releases/latest)**

</div>

---

## Ce que fait AsleRec

| | |
|---|---|
| **Zone ou plein écran** | Un raccourci ouvre un calque de sélection ; tracez le rectangle et l'enregistrement démarre. `Entrée` prend l'écran entier. |
| **Audio complet** | Son de l'ordinateur (boucle système) et microphone, mixés dans une piste unique, chacun activable et dosable séparément. |
| **Définitions** | 240p, 480p, 720p (par défaut) et 1080p, en 24, 30 ou 60 i/s. Le préréglage est un **plafond** : une petite zone n'est jamais agrandie. |
| **Barre flottante** | Chronomètre, pause, arrêt, annulation. Elle est exclue de la capture (`setContentProtection`). |
| **Éditeur intégré** | Découpe sur timeline, recadrage à la souris, export d'un extrait à part, remplacement de l'original. |
| **Export audio** | MP3, M4A ou WAV, sur la sélection ou sur la totalité. |
| **Démarrage Windows** | Lancement à l'ouverture de session, en arrière-plan, désactivable. Raccourcis actifs même fenêtre fermée. |

Les raccourcis par défaut :

| Action | Raccourci |
|---|---|
| Enregistrer une zone | `Ctrl + Maj + R` |
| Enregistrer l'écran entier | `Ctrl + Maj + F` |
| Arrêter | `Ctrl + Maj + S` |
| Pause / reprise | `Ctrl + Maj + P` |

Tous modifiables dans **Réglages → Raccourcis clavier**.

---

## Installation

Téléchargez `AsleRec-Setup-<version>.exe` depuis les *releases*, puis suivez
l'installeur. Le dossier des enregistrements se choisit au **premier
lancement** — c'est plus clair qu'une page d'installeur, et il reste
modifiable ensuite dans les réglages.

---

## Développement

```bash
npm install
npm run dev        # application en mode développement, rechargement à chaud
npm run typecheck  # vérification TypeScript
npm run build      # bundles de production dans out/
npm run dist       # installeur NSIS dans release/<version>/   (Windows requis)
```

> **`npm run dist` ne fonctionne que sous Windows.** electron-builder appelle
> `rcedit` pour écrire l'icône et les métadonnées dans l'exécutable ; l'outil
> exige Wine 32 bits sur Linux. Le workflow `.github/workflows/build-windows.yml`
> construit l'installeur sur un *runner* `windows-latest` et le publie en
> artefact — poussez un tag `v*` pour l'attacher à une release.

`npm run icons` régénère `build/icon.ico`, les icônes de la zone de
notification et le bandeau de l'installeur. Le script `scripts/generate-icons.mjs`
dessine et encode PNG / ICO / BMP à la main, sans aucune dépendance graphique.

### Publier le site de documentation

Le site vit dans `docs/`. GitHub Pages doit être activé une fois à la main :
le jeton des Actions n'a pas le droit de le faire lui-même. Deux options, au
choix, dans **Settings → Pages** :

| Source | Réglage | Effet |
|---|---|---|
| **GitHub Actions** *(conseillé)* | Source → *GitHub Actions* | Le workflow `pages.yml` publie `docs/` à chaque modification |
| **Deploy from a branch** | Branche `claude/dapp-pc-idea-nfdeez`, dossier `/docs` | Publication immédiate, sans workflow |

Le site est ensuite servi sur `https://veqtadev.github.io/AsleRec/`.

---

## Architecture

```
src/
├── main/            process principal (Node)
│   ├── index.ts       cycle de vie, protocole aslerec://, permissions
│   ├── recording.ts   orchestration d'une session, décompte, encodage final
│   ├── windows.ts     fenêtres : principale, calque de zone, barre, moteur
│   ├── library.ts     index des enregistrements, vignettes
│   ├── editor.ts      découpe, recadrage, export audio (FFmpeg)
│   ├── ffmpeg.ts      exécution et sonde FFmpeg / ffprobe
│   ├── settings.ts    préférences, écriture atomique
│   ├── shortcuts.ts   raccourcis globaux
│   └── tray.ts        zone de notification
├── preload/         pont contextuel typé (window.aslerec)
├── shared/          types et canaux IPC communs
└── renderer/
    ├── index.html      interface principale (React)
    ├── overlay.html    calque de sélection de zone
    ├── controlbar.html barre flottante d'enregistrement
    ├── recorder.html   moteur de capture (fenêtre invisible)
    └── src/            composants, pages, styles
```

### Comment la capture fonctionne

1. Le raccourci déclenche `recording().start(mode)` dans le process principal.
2. En mode zone, un calque transparent par écran laisse tracer le rectangle ;
   les coordonnées sont converties en **pixels physiques** via le
   `scaleFactor` de l'écran.
3. `setDisplayMediaRequestHandler` fournit la source à Chromium et demande
   `audio: 'loopback'` pour le son du PC. Le micro passe par `getUserMedia`,
   les deux sont mixés par la Web Audio API.
4. Le recadrage et la mise à l'échelle se font en direct dans un `<canvas>` ;
   si aucun des deux n'est nécessaire, la piste d'origine est transmise telle
   quelle, sans coût CPU.
5. `MediaRecorder` privilégie **H.264** (accéléré matériellement). Les
   morceaux sont écrits au fil de l'eau sur le disque, jamais accumulés en RAM.
6. À l'arrêt, FFmpeg remuxe vers MP4 — flux vidéo recopié tel quel quand le
   codec est déjà compatible, donc quasi instantané.

Le moteur de capture vit dans une fenêtre invisible dédiée : fermer
l'interface n'interrompt pas un enregistrement en cours.

---

## Licence

MIT — voir [LICENSE.txt](LICENSE.txt). AsleRec embarque FFmpeg et ffprobe
(LGPL v2.1+), non modifiés, via `ffmpeg-static` et `ffprobe-static`.

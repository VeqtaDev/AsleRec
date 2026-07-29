import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Vidéo promotionnelle d'AsleRec — 24 s à 30 i/s en 1920×1080.
 * Reprend les jetons de design de l'application : noir profond, blanc,
 * un seul rouge, courbes et rayons façon iOS.
 */

const RED = "#FF2D3F";
const RED_DEEP = "#D81326";
const BG = "#0B0B0D";
const RAISED = "#141418";
const TEXT = "#F7F7F8";
const TEXT_DIM = "rgba(247,247,248,0.6)";
const HAIRLINE = "rgba(255,255,255,0.12)";
const FONT =
  "'SF Pro Display','Segoe UI Variable Display','Segoe UI',system-ui,-apple-system,sans-serif";

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

/** Fond commun : noir avec halo rouge discret. */
const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 78% -12%, rgba(255,45,63,0.13), transparent 60%),
                   radial-gradient(900px 560px at 6% 110%, rgba(255,45,63,0.07), transparent 60%),
                   ${BG}`,
    }}
  />
);

/** Pastille-logo : carré arrondi rouge, point blanc. */
const LogoMark: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      background: `linear-gradient(150deg, #FF4B5C, ${RED_DEEP})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 ${size * 0.08}px ${size * 0.4}px rgba(255,45,63,0.45)`,
    }}
  >
    <div
      style={{
        width: size * 0.34,
        height: size * 0.34,
        borderRadius: "50%",
        background: "#fff",
      }}
    />
  </div>
);

/** Entrée standard d'une scène : fondu + légère montée. */
const useSceneIn = (delay = 0): React.CSSProperties => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 90 },
  });
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [36, 0])}px)`,
  };
};

/** Sortie de scène : fondu sur les dernières frames de la séquence. */
const useSceneOut = (durationInFrames: number, fadeFrames = 12): number => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [durationInFrames - fadeFrames, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

const SceneTitle: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const style = useSceneIn(delay);
  return (
    <div
      style={{
        ...style,
        fontFamily: FONT,
        fontSize: 76,
        fontWeight: 750,
        letterSpacing: "-0.03em",
        color: TEXT,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
};

/** Touche de clavier façon iOS sombre. */
const Key: React.FC<{ label: string; delay: number }> = ({ label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.6 },
  });
  return (
    <div
      style={{
        transform: `scale(${pop})`,
        padding: "26px 44px",
        borderRadius: 22,
        background: RAISED,
        border: `2px solid ${HAIRLINE}`,
        boxShadow: "0 14px 40px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.07)",
        fontFamily: FONT,
        fontSize: 54,
        fontWeight: 650,
        color: TEXT,
      }}
    >
      {label}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Scène 1 — Logo                                                      */
/* ------------------------------------------------------------------ */

const SceneIntro: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = useSceneOut(durationInFrames);

  const mark = spring({ frame, fps, config: { damping: 11, stiffness: 120, mass: 0.8 } });
  const word = spring({ frame: frame - 12, fps, config: { damping: 200, stiffness: 80 } });
  const tag = spring({ frame: frame - 28, fps, config: { damping: 200, stiffness: 80 } });

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", gap: 44, opacity: out }}
    >
      <div style={{ transform: `scale(${mark})` }}>
        <LogoMark size={210} />
      </div>
      <div
        style={{
          opacity: word,
          transform: `translateY(${interpolate(word, [0, 1], [30, 0])}px)`,
          fontFamily: FONT,
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: TEXT,
        }}
      >
        AsleRec
      </div>
      <div
        style={{
          opacity: tag,
          transform: `translateY(${interpolate(tag, [0, 1], [24, 0])}px)`,
          fontFamily: FONT,
          fontSize: 44,
          fontWeight: 500,
          color: TEXT_DIM,
        }}
      >
        Enregistrez votre écran. <span style={{ color: RED }}>Sans y penser.</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scène 2 — Raccourci + sélection de zone                             */
/* ------------------------------------------------------------------ */

const SceneSelection: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const out = useSceneOut(durationInFrames);

  // Le cadre de sélection se dessine entre les frames 45 et 95.
  const draw = interpolate(frame, [45, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });

  const screenW = 1150;
  const screenH = 560;
  const selW = interpolate(draw, [0, 1], [70, 720]);
  const selH = interpolate(draw, [0, 1], [46, 400]);
  const badge = interpolate(frame, [90, 102], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#fff",
    border: `4px solid ${RED}`,
    opacity: badge,
  };

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", gap: 54, opacity: out }}
    >
      <SceneTitle>
        Un raccourci. <span style={{ color: RED }}>Une zone.</span>
      </SceneTitle>

      <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
        <Key label="Ctrl" delay={8} />
        <Key label="Maj" delay={14} />
        <Key label="R" delay={20} />
      </div>

      {/* Écran factice avec voile et cadre de sélection */}
      <div
        style={{
          position: "relative",
          width: screenW,
          height: screenH,
          borderRadius: 28,
          background: "linear-gradient(160deg, #1b1b21, #101014)",
          border: `2px solid ${HAIRLINE}`,
          overflow: "hidden",
          opacity: interpolate(frame, [30, 44], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "rgba(6,6,8,0.5)" }} />
        <div
          style={{
            position: "absolute",
            left: (screenW - selW) / 2,
            top: (screenH - selH) / 2,
            width: selW,
            height: selH,
            border: `3px solid ${RED}`,
            background: "rgba(255,255,255,0.045)",
            boxShadow: "0 0 44px rgba(255,45,63,0.4)",
          }}
        >
          <div style={{ ...handleStyle, top: -13, left: -13 }} />
          <div style={{ ...handleStyle, top: -13, right: -13 }} />
          <div style={{ ...handleStyle, bottom: -13, left: -13 }} />
          <div style={{ ...handleStyle, bottom: -13, right: -13 }} />
          <div
            style={{
              position: "absolute",
              top: -64,
              left: 0,
              opacity: badge,
              padding: "10px 24px",
              borderRadius: 999,
              background: RED,
              color: "#fff",
              fontFamily: FONT,
              fontSize: 30,
              fontWeight: 650,
              fontVariantNumeric: "tabular-nums",
              boxShadow: "0 10px 30px rgba(255,45,63,0.4)",
            }}
          >
            1280 × 720
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scène 3 — Enregistrement + audio                                    */
/* ------------------------------------------------------------------ */

const SceneRecording: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = useSceneOut(durationInFrames);
  const barIn = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120 } });

  const seconds = Math.max(0, Math.floor((frame - 20) / fps));
  const timer = `00:${String(seconds).padStart(2, "0")}`;
  const pulse = 1 + 0.25 * Math.sin((frame / fps) * Math.PI * 2.2);

  // Barres d'onde déterministes : mélange de sinusoïdes, pas d'aléatoire.
  const bars = Array.from({ length: 34 }, (_, i) => {
    const level =
      0.32 +
      0.3 * Math.abs(Math.sin(i * 0.9 + frame / 5.5)) +
      0.24 * Math.abs(Math.sin(i * 0.45 - frame / 8.5));
    return Math.min(1, level);
  });

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", gap: 64, opacity: out }}
    >
      <SceneTitle>
        Vidéo <span style={{ color: RED }}>+ son du PC + micro</span>
      </SceneTitle>

      {/* Barre de contrôle flottante */}
      <div
        style={{
          transform: `scale(${barIn})`,
          display: "flex",
          alignItems: "center",
          gap: 32,
          padding: "30px 46px",
          borderRadius: 999,
          background: "rgba(20,20,24,0.92)",
          border: `2px solid rgba(255,255,255,0.16)`,
          boxShadow: "0 34px 90px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: RED,
            boxShadow: `0 0 0 ${8 * pulse}px rgba(255,45,63,0.25)`,
          }}
        />
        <div
          style={{
            fontFamily: FONT,
            fontSize: 52,
            fontWeight: 650,
            color: TEXT,
            fontVariantNumeric: "tabular-nums",
            minWidth: 150,
          }}
        >
          {timer}
        </div>
        <div style={{ width: 2, height: 46, background: HAIRLINE }} />
        {/* Pause */}
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.09)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}
        >
          <div style={{ width: 9, height: 30, borderRadius: 4, background: TEXT }} />
          <div style={{ width: 9, height: 30, borderRadius: 4, background: TEXT }} />
        </div>
        {/* Stop */}
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: "50%",
            background: RED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 34px rgba(255,45,63,0.4)",
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff" }} />
        </div>
      </div>

      {/* Forme d'onde */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 130 }}>
        {bars.map((level, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 16 + level * 110,
              borderRadius: 8,
              background:
                i % 2 === 0 ? RED : "rgba(247,247,248,0.4)",
            }}
          />
        ))}
      </div>

      <div style={{ fontFamily: FONT, fontSize: 36, color: TEXT_DIM, fontWeight: 500 }}>
        Mixés automatiquement, gains réglables
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scène 4 — Éditeur                                                   */
/* ------------------------------------------------------------------ */

const SceneEditor: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const out = useSceneOut(durationInFrames);

  const railW = 1240;
  // Les poignées se resserrent sur la sélection.
  const tighten = interpolate(frame, [25, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const left = interpolate(tighten, [0, 1], [0, railW * 0.24]);
  const right = interpolate(tighten, [0, 1], [railW, railW * 0.78]);
  const playhead =
    left +
    ((right - left) *
      ((frame % 70) / 70));

  const appear = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", gap: 70, opacity: out }}
    >
      <SceneTitle>
        Découpez. Recadrez. <span style={{ color: RED }}>Exportez.</span>
      </SceneTitle>

      <div style={{ opacity: appear, display: "flex", flexDirection: "column", gap: 40 }}>
        {/* Timeline */}
        <div style={{ position: "relative", width: railW, height: 120 }}>
          <div
            style={{
              position: "absolute",
              top: 26,
              left: 0,
              right: 0,
              height: 68,
              borderRadius: 20,
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 3px, rgba(255,255,255,0.03) 3px 34px)",
              border: `2px solid ${HAIRLINE}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 26,
              left,
              width: right - left,
              height: 68,
              borderRadius: 14,
              background: "rgba(255,45,63,0.22)",
              borderTop: `4px solid ${RED}`,
              borderBottom: `4px solid ${RED}`,
            }}
          />
          {[left, right].map((x, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 12,
                left: x - 9,
                width: 18,
                height: 96,
                borderRadius: 9,
                background: RED,
                boxShadow: "0 8px 26px rgba(255,45,63,0.5)",
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              top: 6,
              left: playhead,
              width: 4,
              height: 108,
              borderRadius: 2,
              background: "#fff",
              boxShadow: "0 0 18px rgba(255,255,255,0.5)",
            }}
          />
        </div>

        {/* Boutons d'export */}
        <div style={{ display: "flex", gap: 22, justifyContent: "center" }}>
          {["Extrait à part", "Remplacer l'original", "Audio seul · MP3"].map(
            (label, i) => {
              const chipIn = interpolate(frame, [55 + i * 9, 68 + i * 9], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={label}
                  style={{
                    opacity: chipIn,
                    transform: `translateY(${(1 - chipIn) * 22}px)`,
                    padding: "18px 34px",
                    borderRadius: 999,
                    background: i === 0 ? RED : "rgba(255,255,255,0.09)",
                    color: i === 0 ? "#fff" : TEXT,
                    fontFamily: FONT,
                    fontSize: 32,
                    fontWeight: 600,
                    boxShadow: i === 0 ? "0 12px 36px rgba(255,45,63,0.35)" : "none",
                  }}
                >
                  {label}
                </div>
              );
            },
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scène 5 — Caractéristiques                                          */
/* ------------------------------------------------------------------ */

const SceneFeatures: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = useSceneOut(durationInFrames);

  const chips = [
    "240p → 1080p",
    "24 · 30 · 60 i/s",
    "MP4 · WebM",
    "MP3 · WAV · M4A",
    "Démarre avec Windows",
    "Raccourcis globaux",
  ];

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", gap: 70, opacity: out }}
    >
      <SceneTitle>
        Tout est <span style={{ color: RED }}>intégré</span>
      </SceneTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, auto)",
          gap: 26,
          justifyContent: "center",
        }}
      >
        {chips.map((label, i) => {
          const pop = spring({
            frame: frame - 8 - i * 5,
            fps,
            config: { damping: 13, stiffness: 160, mass: 0.7 },
          });
          return (
            <div
              key={label}
              style={{
                transform: `scale(${pop})`,
                padding: "26px 44px",
                borderRadius: 24,
                background: RAISED,
                border: `2px solid ${i < 2 ? "rgba(255,45,63,0.45)" : HAIRLINE}`,
                fontFamily: FONT,
                fontSize: 38,
                fontWeight: 600,
                color: TEXT,
                boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scène 6 — Conclusion                                                */
/* ------------------------------------------------------------------ */

const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mark = spring({ frame, fps, config: { damping: 12, stiffness: 130 } });
  const text = spring({ frame: frame - 10, fps, config: { damping: 200, stiffness: 90 } });
  const url = spring({ frame: frame - 24, fps, config: { damping: 200, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 42 }}>
      <div style={{ transform: `scale(${mark})` }}>
        <LogoMark size={170} />
      </div>
      <div
        style={{
          opacity: text,
          fontFamily: FONT,
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: TEXT,
        }}
      >
        AsleRec
      </div>
      <div
        style={{
          opacity: text,
          fontFamily: FONT,
          fontSize: 40,
          fontWeight: 500,
          color: TEXT_DIM,
        }}
      >
        Gratuit · Open source · Windows 10 et 11
      </div>
      <div
        style={{
          opacity: url,
          transform: `translateY(${interpolate(url, [0, 1], [20, 0])}px)`,
          padding: "22px 52px",
          borderRadius: 999,
          background: RED,
          color: "#fff",
          fontFamily: FONT,
          fontSize: 40,
          fontWeight: 650,
          boxShadow: "0 18px 55px rgba(255,45,63,0.42)",
        }}
      >
        veqtadev.github.io/AsleRec
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

const SCENES = {
  intro: 90,
  selection: 165,
  recording: 150,
  editor: 150,
  features: 90,
  outro: 75,
};

export const PROMO_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const AsleRecPromo: React.FC = () => {
  let at = 0;
  const from = (n: number): number => {
    const start = at;
    at += n;
    return start;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Backdrop />
      <Sequence from={from(SCENES.intro)} durationInFrames={SCENES.intro}>
        <SceneIntro durationInFrames={SCENES.intro} />
      </Sequence>
      <Sequence from={from(SCENES.selection)} durationInFrames={SCENES.selection}>
        <SceneSelection durationInFrames={SCENES.selection} />
      </Sequence>
      <Sequence from={from(SCENES.recording)} durationInFrames={SCENES.recording}>
        <SceneRecording durationInFrames={SCENES.recording} />
      </Sequence>
      <Sequence from={from(SCENES.editor)} durationInFrames={SCENES.editor}>
        <SceneEditor durationInFrames={SCENES.editor} />
      </Sequence>
      <Sequence from={from(SCENES.features)} durationInFrames={SCENES.features}>
        <SceneFeatures durationInFrames={SCENES.features} />
      </Sequence>
      <Sequence from={from(SCENES.outro)} durationInFrames={SCENES.outro}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};

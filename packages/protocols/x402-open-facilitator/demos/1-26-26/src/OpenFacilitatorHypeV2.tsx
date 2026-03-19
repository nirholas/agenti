import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  Easing,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";

const { fontFamily: interFont } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const { fontFamily: monoFont } = loadJetBrains("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const COLORS = {
  background: "#FFFFFF",
  backgroundDark: "#0A0A0B",
  primary: "#000000",
  accent: "#0B64F4",
  accentLight: "#E8F0FE",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  borderDark: "#27272A",
  codeBg: "#18181B",
  codeText: "#E4E4E7",
  codeKeyword: "#7DD3FC",
  codeString: "#BEF264",
  codeComment: "#71717A",
};

// ============================================
// SHARED COMPONENTS
// ============================================

const Logo = ({ size = 60, showText = false, dark = false }: { size?: number; showText?: boolean; dark?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.25 }}>
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <rect width="180" height="180" rx="36" fill={COLORS.accent} />
      <path
        d="M130 94.9983C130 119.998 112.5 132.498 91.7 139.748C90.6108 140.117 89.4277 140.1 88.35 139.698C67.5 132.498 50 119.998 50 94.9983V59.9983C50 58.6723 50.5268 57.4005 51.4645 56.4628C52.4021 55.5251 53.6739 54.9983 55 54.9983C65 54.9983 77.5 48.9983 86.2 41.3983C87.2593 40.4933 88.6068 39.9961 90 39.9961C91.3932 39.9961 92.7407 40.4933 93.8 41.3983C102.55 49.0483 115 54.9983 125 54.9983C126.326 54.9983 127.598 55.5251 128.536 56.4628C129.473 57.4005 130 58.6723 130 59.9983V94.9983Z"
        stroke="white"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M75 90L85 100L105 80"
        stroke="white"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    {showText && (
      <span
        style={{
          fontFamily: interFont,
          fontWeight: 700,
          fontSize: size * 0.4,
          color: dark ? "#FFFFFF" : COLORS.primary,
        }}
      >
        OpenFacilitator
      </span>
    )}
  </div>
);

// Animated cursor
const Cursor = ({
  x,
  y,
  clicking = false,
  visible = true,
}: {
  x: number;
  y: number;
  clicking?: boolean;
  visible?: boolean;
}) => {
  const frame = useCurrentFrame();
  const clickScale = clicking ? 0.8 + Math.sin(frame * 0.5) * 0.1 : 1;

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `scale(${clickScale})`,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M5.5 3.21V20.8C5.5 21.31 6.09 21.57 6.44 21.2L10.35 16.83L14.79 16.95C15.26 16.96 15.5 16.38 15.17 16.06L6.08 3.21C5.81 2.93 5.5 2.93 5.5 3.21Z"
          fill="white"
          stroke="black"
          strokeWidth="1.5"
        />
      </svg>
      {clicking && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 30,
            height: 30,
            borderRadius: "50%",
            backgroundColor: COLORS.accent,
            opacity: 0.3,
            transform: "translate(-3px, -3px)",
          }}
        />
      )}
    </div>
  );
};

// Click ripple effect
const ClickRipple = ({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = Math.max(0, frame - delay);
  const scale = interpolate(progress, [0, fps * 0.5], [0, 2], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, fps * 0.5], [0.6, 0], {
    extrapolateRight: "clamp",
  });

  if (progress <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x - 20,
        top: y - 20,
        width: 40,
        height: 40,
        borderRadius: "50%",
        backgroundColor: COLORS.accent,
        transform: `scale(${scale})`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// Browser chrome wrapper
const BrowserWindow = ({
  children,
  url = "app.openfacilitator.com",
  dark = false,
  width = 1400,
  height = 800,
}: {
  children: React.ReactNode;
  url?: string;
  dark?: boolean;
  width?: number;
  height?: number;
}) => {
  const bg = dark ? COLORS.backgroundDark : COLORS.background;
  const borderColor = dark ? COLORS.borderDark : COLORS.border;
  const textColor = dark ? COLORS.textLight : COLORS.textMuted;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: bg,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 40px 120px rgba(0,0,0,0.3)",
        border: `1px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 56,
          backgroundColor: dark ? "#09090B" : "#FAFAFA",
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FF5F56" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#27C93F" }} />
        </div>

        {/* URL bar */}
        <div
          style={{
            flex: 1,
            height: 36,
            backgroundColor: dark ? "#18181B" : "#FFFFFF",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${borderColor}`,
          }}
        >
          <span style={{ fontFamily: interFont, fontSize: 15, color: textColor }}>{url}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
  );
};

// Code editor with typing animation
const CodeEditor = ({
  lines,
  typingLine = -1,
  typingProgress = 1,
}: {
  lines: { code: string; indent?: number }[];
  typingLine?: number;
  typingProgress?: number;
}) => {
  const renderCode = (code: string, lineIndex: number) => {
    const isTyping = lineIndex === typingLine;
    const displayCode = isTyping ? code.slice(0, Math.floor(code.length * typingProgress)) : code;

    // Simple syntax highlighting
    const highlighted = displayCode
      .replace(/(import|from|const|export|async|await|return)/g, `<keyword>$1</keyword>`)
      .replace(/('.*?'|".*?")/g, `<string>$1</string>`)
      .replace(/(\/\/.*)/g, `<comment>$1</comment>`);

    return (
      <span
        dangerouslySetInnerHTML={{
          __html: highlighted
            .replace(/<keyword>/g, `<span style="color: ${COLORS.codeKeyword}">`)
            .replace(/<\/keyword>/g, "</span>")
            .replace(/<string>/g, `<span style="color: ${COLORS.codeString}">`)
            .replace(/<\/string>/g, "</span>")
            .replace(/<comment>/g, `<span style="color: ${COLORS.codeComment}">`)
            .replace(/<\/comment>/g, "</span>"),
        }}
      />
    );
  };

  return (
    <div
      style={{
        backgroundColor: COLORS.codeBg,
        borderRadius: 12,
        padding: 24,
        fontFamily: monoFont,
        fontSize: 18,
        lineHeight: 1.8,
        color: COLORS.codeText,
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ paddingLeft: (line.indent || 0) * 20, minHeight: 32 }}>
          {i <= typingLine && renderCode(line.code, i)}
          {i === typingLine && typingProgress < 1 && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 20,
                backgroundColor: COLORS.accent,
                marginLeft: 2,
                animation: "blink 1s infinite",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// Dashboard stat card
const StatCard = ({
  label,
  value,
  trend,
  delay = 0,
}: {
  label: string;
  value: string;
  trend?: string;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 32,
        border: `1px solid ${COLORS.border}`,
        transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
        opacity: progress,
      }}
    >
      <p style={{ fontFamily: interFont, fontSize: 18, color: COLORS.textMuted, margin: 0 }}>
        {label}
      </p>
      <p
        style={{
          fontFamily: interFont,
          fontSize: 42,
          fontWeight: 700,
          color: COLORS.primary,
          margin: "12px 0 0 0",
        }}
      >
        {value}
      </p>
      {trend && (
        <p style={{ fontFamily: interFont, fontSize: 18, color: COLORS.success, margin: "8px 0 0 0" }}>
          {trend}
        </p>
      )}
    </div>
  );
};

// Transaction row
const TransactionRow = ({
  agent,
  amount,
  status,
  delay = 0,
}: {
  agent: string;
  amount: string;
  status: "completed" | "pending";
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20 },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 28px",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        transform: `translateX(${interpolate(slideIn, [0, 1], [50, 0])}px)`,
        opacity: slideIn,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: COLORS.accentLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 24 }}>🤖</span>
        </div>
        <span style={{ fontFamily: interFont, fontSize: 20, fontWeight: 500 }}>{agent}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 600 }}>{amount}</span>
        <div
          style={{
            padding: "8px 16px",
            borderRadius: 24,
            backgroundColor: status === "completed" ? "#D1FAE5" : "#FEF3C7",
            color: status === "completed" ? COLORS.success : COLORS.warning,
            fontFamily: interFont,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {status === "completed" ? "Completed" : "Pending"}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SCENES
// ============================================

// Scene 1: Hook - Narrative text build
const SceneHook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Lines and their timing
  const lines = [
    { text: "Agents are the future", start: 0, style: "context" },
    { text: "They need to pay for your services", start: fps * 1.2, style: "context" },
    { text: "They need x402", start: fps * 2.4, style: "context" },
    { text: "You need a facilitator", start: fps * 3.6, style: "emphasis" },
    { text: "Don't pay one", start: fps * 5, style: "punchline" },
    { text: "Become one", start: fps * 5.8, style: "hero" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.backgroundDark,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {lines.map((line, i) => {
        const lineIn = spring({
          frame: frame - line.start,
          fps,
          config: { damping: 15, stiffness: 120 },
        });

        // Fade out earlier lines as new ones come in
        const nextLine = lines[i + 1];
        const fadeOutStart = nextLine ? nextLine.start : fps * 10;
        const opacity =
          line.style === "hero" || line.style === "punchline"
            ? lineIn
            : interpolate(frame, [fadeOutStart, fadeOutStart + fps * 0.3], [lineIn, lineIn * 0.3], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

        const isHero = line.style === "hero";
        const isPunchline = line.style === "punchline";
        const isEmphasis = line.style === "emphasis";

        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateY(${interpolate(lineIn, [0, 1], [20, 0])}px)`,
              display: "flex",
              flexDirection: isHero ? "column" : "row",
              alignItems: "center",
              gap: isHero ? 40 : 20,
            }}
          >
            <p
              style={{
                fontFamily: interFont,
                fontSize: isHero ? 80 : isPunchline ? 56 : isEmphasis ? 48 : 40,
                fontWeight: isHero ? 900 : isPunchline ? 700 : isEmphasis ? 600 : 500,
                color: isHero
                  ? "#FFFFFF"
                  : isPunchline
                  ? COLORS.textLight
                  : isEmphasis
                  ? "#FFFFFF"
                  : COLORS.textMuted,
                margin: 0,
              }}
            >
              {line.text}
            </p>
            {isHero && <Logo size={140} />}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Scene 2: The Problem - Other facilitators' nonsense
const SceneProblem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const item1In = spring({ frame, fps, config: { damping: 15 } });
  const item2In = spring({ frame: frame - fps * 0.8, fps, config: { damping: 15 } });
  const item3In = spring({ frame: frame - fps * 1.6, fps, config: { damping: 15 } });
  const item4In = spring({ frame: frame - fps * 2.4, fps, config: { damping: 15 } });

  const ProblemItem = ({
    text,
    progress,
    highlight = false,
  }: {
    text: string;
    progress: number;
    highlight?: boolean;
  }) => (
    <div
      style={{
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
        padding: "20px 40px",
        backgroundColor: highlight ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
        borderRadius: 12,
        border: highlight ? `1px solid ${COLORS.danger}` : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <p
        style={{
          fontFamily: interFont,
          fontSize: 32,
          fontWeight: 600,
          color: highlight ? COLORS.danger : "#FFFFFF",
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.backgroundDark,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      {/* Header */}
      <p
        style={{
          fontFamily: interFont,
          fontSize: 24,
          color: COLORS.textLight,
          margin: "0 0 24px 0",
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Other facilitators?
      </p>

      <ProblemItem text="Monthly fees" progress={item1In} />
      <ProblemItem text="Credit-based pricing" progress={item2In} />
      <ProblemItem text="Settlement limits" progress={item3In} />
      <ProblemItem text="They own your data" progress={item4In} highlight />

      {/* Bottom line */}
      <Sequence from={fps * 4} layout="none">
        <p
          style={{
            fontFamily: interFont,
            fontSize: 48,
            fontWeight: 900,
            color: "#FFFFFF",
            margin: "40px 0 0 0",
          }}
        >
          Why?
        </p>
      </Sequence>
    </AbsoluteFill>
  );
};

// Scene 3: Simple setup - just our 1 line
const SceneSetup = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  const textIn = spring({
    frame: frame - fps * 0.5,
    fps,
    config: { damping: 15 },
  });

  const codeIn = spring({
    frame: frame - fps * 1.2,
    fps,
    config: { damping: 12 },
  });

  // Typing animation for code
  const codeText = "app.use(createPaymentMiddleware())";
  const charsToShow = Math.min(
    codeText.length,
    Math.max(0, Math.floor((frame - fps * 1.5) * 0.8))
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.backgroundDark,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          opacity: logoIn,
          transform: `scale(${interpolate(logoIn, [0, 1], [0.8, 1])})`,
        }}
      >
        <Logo size={80} showText dark />
      </div>

      {/* "Get started" text */}
      <p
        style={{
          fontFamily: interFont,
          fontSize: 32,
          color: COLORS.textLight,
          margin: 0,
          opacity: textIn,
        }}
      >
        Get started with one line
      </p>

      {/* The code - typing animation */}
      <div
        style={{
          opacity: codeIn,
          transform: `translateY(${interpolate(codeIn, [0, 1], [20, 0])}px)`,
        }}
      >
        <pre
          style={{
            fontFamily: monoFont,
            fontSize: 40,
            color: COLORS.codeText,
            margin: 0,
          }}
        >
          <span style={{ color: COLORS.codeKeyword }}>
            {codeText.slice(0, Math.min(charsToShow, 3))}
          </span>
          <span>
            {codeText.slice(3, Math.min(charsToShow, 7))}
          </span>
          <span style={{ color: COLORS.codeString }}>
            {codeText.slice(7, Math.min(charsToShow, 31))}
          </span>
          <span>
            {codeText.slice(31, charsToShow)}
          </span>
          {charsToShow < codeText.length && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 36,
                backgroundColor: COLORS.accent,
                marginLeft: 2,
                opacity: Math.floor(frame / 8) % 2,
                verticalAlign: "middle",
              }}
            />
          )}
        </pre>
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Dashboard Demo - Show the OpenFacilitator dashboard
const SceneDashboard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const browserIn = spring({
    frame,
    fps,
    config: { damping: 15 },
  });

  // Bottom feature words - cycle through
  const features = [
    "Your data",
    "Your revenue",
    "Your rules",
  ];

  const featureDuration = fps * 2.5;
  const activeFeature = Math.min(
    features.length - 1,
    Math.floor((frame - fps * 0.5) / featureDuration)
  );

  const featureProgress = spring({
    frame: (frame - fps * 0.5) % featureDuration,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
      }}
    >
      {/* Dashboard - smaller, centered, upper area */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          transform: `translate(-50%, -50%) scale(${browserIn * 0.7})`,
          opacity: browserIn,
        }}
      >
        <BrowserWindow url="app.openfacilitator.com" width={1400} height={700}>
          <div style={{ display: "flex", height: "100%" }}>
            {/* Sidebar */}
            <div
              style={{
                width: 240,
                backgroundColor: "#FAFAFA",
                borderRight: `1px solid ${COLORS.border}`,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
                <Logo size={36} />
                <span style={{ fontFamily: interFont, fontWeight: 700, fontSize: 18 }}>
                  OpenFacilitator
                </span>
              </div>

              {["Dashboard", "Transactions", "Webhooks", "Settings"].map((item, i) => (
                <div
                  key={item}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 10,
                    backgroundColor: i === 0 ? COLORS.accentLight : "transparent",
                    color: i === 0 ? COLORS.accent : COLORS.textMuted,
                    fontFamily: interFont,
                    fontSize: 16,
                    fontWeight: i === 0 ? 600 : 500,
                    marginBottom: 6,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, padding: 32 }}>
              <h2 style={{ fontFamily: interFont, fontSize: 28, fontWeight: 700, margin: "0 0 28px 0" }}>
                Dashboard
              </h2>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
                <StatCard label="Total Revenue" value="$24,891" trend="+12.5%" delay={fps * 0.3} />
                <StatCard label="Transactions" value="1,284" trend="+8.2%" delay={fps * 0.5} />
                <StatCard label="Active Agents" value="47" trend="+3" delay={fps * 0.7} />
              </div>

              {/* Recent transactions */}
              <h3 style={{ fontFamily: interFont, fontSize: 20, fontWeight: 600, margin: "0 0 18px 0" }}>
                Recent Transactions
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <TransactionRow agent="Claude Agent" amount="$49.00" status="completed" delay={fps * 1} />
                <TransactionRow agent="GPT-4 Assistant" amount="$125.00" status="completed" delay={fps * 1.2} />
                <TransactionRow agent="Gemini Bot" amount="$75.50" status="pending" delay={fps * 1.4} />
              </div>
            </div>
          </div>
        </BrowserWindow>
      </div>

      {/* Bottom feature word */}
      {frame > fps * 0.5 && (
        <div
          style={{
            position: "absolute",
            bottom: 180,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: interFont,
              fontSize: 96,
              fontWeight: 900,
              color: features[Math.max(0, activeFeature)] === "Your rules" ? COLORS.accent : COLORS.primary,
              margin: 0,
              opacity: featureProgress,
              transform: `translateY(${interpolate(featureProgress, [0, 1], [30, 0])}px)`,
            }}
          >
            {features[Math.max(0, activeFeature)]}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Feature Pane - simple animated entry, fills grid cell
const FeaturePane = ({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <div
      style={{
        height: "100%",
        transform: `scale(${interpolate(progress, [0, 1], [0.9, 1])}) translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
        opacity: progress,
      }}
    >
      {children}
    </div>
  );
};

// Mini UI Components for feature panes - fill grid cells
const WebhookPane = () => (
  <div
    style={{
      height: "100%",
      backgroundColor: COLORS.codeBg,
      borderRadius: 24,
      padding: 40,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: COLORS.success }} />
      <span style={{ fontFamily: monoFont, fontSize: 20, color: COLORS.textLight }}>webhook received</span>
    </div>
    <pre style={{ fontFamily: monoFont, fontSize: 22, color: COLORS.codeText, margin: 0, lineHeight: 1.9 }}>
      <span style={{ color: COLORS.codeKeyword }}>{"{"}</span>{"\n"}
      {"  "}<span style={{ color: COLORS.codeString }}>"event"</span>: <span style={{ color: COLORS.codeString }}>"payment.success"</span>,{"\n"}
      {"  "}<span style={{ color: COLORS.codeString }}>"amount"</span>: <span style={{ color: COLORS.codeKeyword }}>4900</span>,{"\n"}
      {"  "}<span style={{ color: COLORS.codeString }}>"agent"</span>: <span style={{ color: COLORS.codeString }}>"claude-3"</span>{"\n"}
      <span style={{ color: COLORS.codeKeyword }}>{"}"}</span>
    </pre>
  </div>
);

const CheckoutPane = () => (
  <div
    style={{
      height: "100%",
      backgroundColor: "#FAFAFA",
      borderRadius: 24,
      padding: 48,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      border: `1px solid ${COLORS.border}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
      <Logo size={44} />
      <span style={{ fontFamily: interFont, fontWeight: 600, fontSize: 24 }}>Checkout</span>
    </div>
    <p style={{ fontFamily: interFont, fontSize: 18, color: COLORS.textMuted, margin: "0 0 8px 0" }}>Amount due</p>
    <p style={{ fontFamily: interFont, fontSize: 72, fontWeight: 800, margin: "0 0 32px 0" }}>$49.00</p>
    <div
      style={{
        backgroundColor: COLORS.accent,
        borderRadius: 16,
        padding: "22px 0",
        textAlign: "center",
        width: 280,
      }}
    >
      <span style={{ fontFamily: interFont, fontSize: 20, fontWeight: 600, color: "#FFFFFF" }}>Pay with x402</span>
    </div>
  </div>
);

const RefundPane = () => (
  <div
    style={{
      height: "100%",
      backgroundColor: "#FAFAFA",
      borderRadius: 24,
      padding: 48,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid ${COLORS.border}`,
    }}
  >
    <div
      style={{
        width: 100,
        height: 100,
        borderRadius: "50%",
        backgroundColor: "#D1FAE5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
      }}
    >
      <span style={{ fontSize: 52, color: COLORS.success }}>✓</span>
    </div>
    <p style={{ fontFamily: interFont, fontSize: 36, fontWeight: 700, margin: "0 0 12px 0" }}>Refund Complete</p>
    <p style={{ fontFamily: interFont, fontSize: 22, color: COLORS.textMuted, margin: 0 }}>$125.00 returned instantly</p>
  </div>
);

const RewardsPane = () => (
  <div
    style={{
      height: "100%",
      backgroundColor: COLORS.backgroundDark,
      borderRadius: 24,
      padding: 48,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}
  >
    <p style={{ fontFamily: interFont, fontSize: 20, color: COLORS.textLight, margin: "0 0 16px 0" }}>$OPEN Rewards</p>
    <p style={{ fontFamily: interFont, fontSize: 72, fontWeight: 800, color: "#FFFFFF", margin: "0 0 32px 0" }}>
      2,847 <span style={{ fontSize: 36, color: COLORS.accent }}>$OPEN</span>
    </p>
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
        <p style={{ fontFamily: interFont, fontSize: 16, color: COLORS.textLight, margin: "0 0 8px 0" }}>This week</p>
        <p style={{ fontFamily: interFont, fontSize: 32, fontWeight: 700, color: COLORS.success, margin: 0 }}>+142</p>
      </div>
      <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
        <p style={{ fontFamily: interFont, fontSize: 16, color: COLORS.textLight, margin: "0 0 8px 0" }}>All time</p>
        <p style={{ fontFamily: interFont, fontSize: 32, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>2,847</p>
      </div>
    </div>
  </div>
);

// Scene 5: Features - clean 2x2 grid
const SceneFeatures = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        padding: 60,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerIn,
          marginBottom: 40,
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: interFont, fontSize: 56, fontWeight: 900, margin: 0 }}>
          Everything built in
        </p>
      </div>

      {/* 2x2 Grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 32,
        }}
      >
        <FeaturePane delay={fps * 0.2}>
          <WebhookPane />
        </FeaturePane>

        <FeaturePane delay={fps * 0.4}>
          <CheckoutPane />
        </FeaturePane>

        <FeaturePane delay={fps * 0.6}>
          <RewardsPane />
        </FeaturePane>

        <FeaturePane delay={fps * 0.8}>
          <RefundPane />
        </FeaturePane>
      </div>
    </AbsoluteFill>
  );
};

// Scene 6: Pricing
const ScenePricing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 15 } });
  const freeIn = spring({ frame: frame - fps * 0.3, fps, config: { damping: 12 } });
  const proIn = spring({ frame: frame - fps * 0.5, fps, config: { damping: 12 } });
  const taglineIn = spring({ frame: frame - fps * 1.5, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerIn,
          transform: `translateY(${interpolate(headerIn, [0, 1], [-20, 0])}px)`,
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: interFont, fontSize: 24, color: COLORS.textMuted, margin: "0 0 8px 0" }}>
          Pricing
        </p>
        <p style={{ fontFamily: interFont, fontSize: 56, fontWeight: 900, color: COLORS.primary, margin: 0 }}>
          Simple. Transparent.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: 40 }}>
        {/* Free tier */}
        <div
          style={{
            width: 380,
            padding: 48,
            backgroundColor: "#FAFAFA",
            borderRadius: 24,
            border: `1px solid ${COLORS.border}`,
            opacity: freeIn,
            transform: `translateY(${interpolate(freeIn, [0, 1], [40, 0])}px)`,
          }}
        >
          <p style={{ fontFamily: interFont, fontSize: 18, fontWeight: 600, color: COLORS.textMuted, margin: "0 0 16px 0" }}>
            Free
          </p>
          <p style={{ fontFamily: interFont, fontSize: 72, fontWeight: 900, margin: "0 0 24px 0", lineHeight: 1 }}>
            $0
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: COLORS.success, fontSize: 20 }}>✓</span>
              <span style={{ fontFamily: interFont, fontSize: 18, color: COLORS.textMuted }}>Hosted infrastructure</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: COLORS.success, fontSize: 20 }}>✓</span>
              <span style={{ fontFamily: interFont, fontSize: 18, color: COLORS.textMuted }}>All features included</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: COLORS.success, fontSize: 20 }}>✓</span>
              <span style={{ fontFamily: interFont, fontSize: 18, color: COLORS.textMuted }}>No platform fees</span>
            </div>
          </div>
        </div>

        {/* Pro tier */}
        <div
          style={{
            width: 380,
            padding: 48,
            backgroundColor: COLORS.accent,
            borderRadius: 24,
            color: "#FFFFFF",
            opacity: proIn,
            transform: `translateY(${interpolate(proIn, [0, 1], [40, 0])}px) scale(${interpolate(proIn, [0, 1], [0.95, 1])})`,
            boxShadow: `0 20px 60px ${COLORS.accent}40`,
          }}
        >
          <p style={{ fontFamily: interFont, fontSize: 18, fontWeight: 600, opacity: 0.9, margin: "0 0 16px 0" }}>
            Pro
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
            <span style={{ fontFamily: interFont, fontSize: 72, fontWeight: 900, lineHeight: 1 }}>$5</span>
            <span style={{ fontFamily: interFont, fontSize: 24, fontWeight: 500, opacity: 0.8 }}>/mo</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <span style={{ fontFamily: interFont, fontSize: 18, opacity: 0.95 }}>Self-host anywhere</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <span style={{ fontFamily: interFont, fontSize: 18, opacity: 0.95 }}>Own your data</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <span style={{ fontFamily: interFont, fontSize: 18, opacity: 0.95 }}>Your brand, your rules</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontFamily: interFont,
          fontSize: 32,
          fontWeight: 700,
          color: COLORS.primary,
          margin: 0,
          opacity: taglineIn,
          transform: `translateY(${interpolate(taglineIn, [0, 1], [20, 0])}px)`,
        }}
      >
        No platform fees. No credit limits. Ever.
      </p>
    </AbsoluteFill>
  );
};

// Scene 7: CTA
const SceneCTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10 },
  });

  const textIn = spring({
    frame: frame - fps * 0.5,
    fps,
    config: { damping: 15 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
      }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <Logo size={120} />
      </div>

      <div style={{ opacity: textIn, transform: `translateY(${interpolate(textIn, [0, 1], [20, 0])}px)` }}>
        <h1 style={{ fontFamily: interFont, fontSize: 72, fontWeight: 900, margin: 0, textAlign: "center" }}>
          Be the facilitator
        </h1>
      </div>

      <Sequence from={fps * 2} layout="none">
        <p style={{ fontFamily: interFont, fontSize: 32, color: COLORS.accent, fontWeight: 600, margin: 0 }}>
          openfacilitator.com
        </p>
      </Sequence>

      <Sequence from={fps * 3} layout="none">
        <p style={{ fontFamily: interFont, fontSize: 20, color: COLORS.textMuted, margin: 0 }}>
          Free to start. $5/month to own it all.
        </p>
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const OpenFacilitatorHypeV2 = () => {
  const { fps } = useVideoConfig();

  const SCENE_DURATIONS = {
    hook: fps * 7,
    problem: fps * 6,
    dashboard: fps * 8,
    features: fps * 6,
    setup: fps * 5,
    pricing: fps * 5,
    cta: fps * 10,
  };

  const TRANSITION = Math.round(fps * 0.4);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.hook}>
        <SceneHook />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.problem}>
        <SceneProblem />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.dashboard}>
        <SceneDashboard />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.features}>
        <SceneFeatures />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.setup}>
        <SceneSetup />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.pricing}>
        <ScenePricing />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.cta}>
        <SceneCTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

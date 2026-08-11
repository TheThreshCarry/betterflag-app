import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "Betterflag Dashboard: feature flags for agentic teams. Targeting, rollouts, and kill switches via MCP and REST.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ORANGE = "#FF5A1A";
const INK = "#171717";
const INK_MUTED = "#737373";
const HAIRLINE = "#E8E4DE";

const CHIPS = [
  { label: "Targeting", color: "#0067F4", bg: "rgba(0,103,244,0.09)" },
  { label: "% Rollouts", color: "#FF5A1A", bg: "rgba(255,90,26,0.09)" },
  { label: "Kill-switch", color: "#FF2C5F", bg: "rgba(255,44,95,0.09)" },
  { label: "Agent-native MCP", color: "#00BC72", bg: "rgba(0,188,114,0.09)" },
  { label: "Audit log", color: "#737373", bg: "rgba(115,115,115,0.09)" },
];

export default async function Image() {
  const [geist, geistSemiBold, mono] = await Promise.all([
    readFile(join(process.cwd(), "assets/og/geist-sans-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/og/geist-sans-latin-600-normal.woff")),
    readFile(join(process.cwd(), "assets/og/geist-mono-latin-400-normal.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          backgroundColor: "#FFFFFF",
          backgroundImage:
            "radial-gradient(760px 460px at 92% -10%, rgba(255,90,26,0.07), transparent 60%)",
          border: `2px solid ${HAIRLINE}`,
          fontFamily: "Geist",
        }}
      >
        {/* Top bar: logo + domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: "#222222",
              }}
            >
              <svg
                width="38"
                height="38"
                viewBox="0 0 155 155"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M67.7248 84.8159L121.298 76.5131L113.229 105.881L44.8111 117.822L33.8384 90.0677L67.7248 84.8159ZM67.7248 84.8159V72.9631M67.7248 72.9631V30.6858L99.3521 61.9904L67.7248 72.9631Z"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: INK,
              }}
            >
              Betterflag
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Geist Mono",
              fontSize: 21,
              color: INK_MUTED,
            }}
          >
            betterflag.app
          </div>
        </div>

        {/* Headline block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                width: 9,
                height: 9,
                borderRadius: 999,
                backgroundColor: ORANGE,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: ORANGE,
              }}
            >
              BETTERFLAG DASHBOARD
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 74,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.06,
              color: INK,
            }}
          >
            <span>Feature flags for</span>
            <span>agentic teams.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 25,
              lineHeight: 1.4,
              color: INK_MUTED,
              maxWidth: 860,
            }}
          >
            Targeting, percentage rollouts, and instant kill switches via
            MCP and REST.
          </div>
          {/* Capability chips (hero style) */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {CHIPS.map((chip) => (
              <div
                key={chip.label}
                style={{
                  display: "flex",
                  padding: "9px 18px",
                  borderRadius: 999,
                  fontSize: 19,
                  fontWeight: 600,
                  color: chip.color,
                  backgroundColor: chip.bg,
                }}
              >
                {chip.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar: value line + tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 21,
              fontWeight: 600,
              color: INK,
            }}
          >
            Unlimited flags, seats & environments, edge-served in &lt;100ms.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geist, weight: 400, style: "normal" },
        { name: "Geist", data: geistSemiBold, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    }
  );
}

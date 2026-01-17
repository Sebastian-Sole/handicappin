import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Handicappin' - Golf Handicap Tracker";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: "linear-gradient(135deg, #1a2e1a 0%, #0f1f0f 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          padding: "40px",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            marginBottom: 20,
            background: "linear-gradient(90deg, #4ade80, #22c55e)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Handicappin&apos;
        </div>
        <div
          style={{
            fontSize: 36,
            opacity: 0.9,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Golf Handicap Tracker & Calculator
        </div>
        <div
          style={{
            fontSize: 24,
            opacity: 0.7,
            marginTop: 20,
          }}
        >
          USGA Compliant | Free Forever
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

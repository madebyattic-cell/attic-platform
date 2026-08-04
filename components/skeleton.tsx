export function SkeletonBlock({ width = "100%", height = 16, radius = 6 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div
      style={{
        width, height, borderRadius: radius, background: "linear-gradient(90deg, #EDEDE4 25%, #E2E2D8 37%, #EDEDE4 63%)",
        backgroundSize: "400% 100%", animation: "shimmer 1.4s ease infinite",
      }}
    />
  );
}

export function SkeletonPage() {
  return (
    <div style={{ padding: "24px 32px" }}>
      <SkeletonBlock width={180} height={24} />
      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <SkeletonBlock width={280} height={13} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={i} height={44} radius={10} />
        ))}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

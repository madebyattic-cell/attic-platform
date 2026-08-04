import { SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F2F3EE" }}>
      <div style={{ width: 200, flexShrink: 0, background: "var(--surface-1)" }} />
      <div style={{ flex: 1 }}>
        <SkeletonPage />
      </div>
    </div>
  );
}

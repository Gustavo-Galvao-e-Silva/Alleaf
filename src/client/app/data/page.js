"use client";

import BottomNav from "../components/BottomNav";

export default function DataPage() {
  return (
    <>
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "rgba(0, 0, 0, 0.45)",
          }}
        >
          Data
        </p>
      </main>
      <BottomNav activeItem="data" />
    </>
  );
}

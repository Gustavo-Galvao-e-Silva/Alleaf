export default function VideoBackground({ className }) {
  return (
    <div className={className} aria-hidden="true">
      <img
        src="/photo/01cd11e3e465d21ade52ec4e7ead0c72.jpg"
        alt=""
        style={{
          position: "absolute",
          inset: "-20px",
          width: "calc(100% + 40px)",
          height: "calc(100% + 40px)",
          objectFit: "cover",
          objectPosition: "center",
          filter: "blur(6px)",
        }}
      />
      {/* White hue overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.08)",
        }}
      />
      {/* Dark gradient overlay for readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}

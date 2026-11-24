import { rims, sheetClipPath } from "@/lib/paper";

/** The aged, torn sheet every page is printed on. See lib/paper.ts and .sheet in globals.css. */
export default function TornPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <div className="sheet" style={{ clipPath: sheetClipPath }}>
        {children}
      </div>
      {rims.map((rim, index) => (
        <svg
          key={index}
          aria-hidden="true"
          focusable="false"
          className="tear-rim"
          style={rim.style}
          viewBox={rim.viewBox}
          preserveAspectRatio={rim.stretch ? "none" : undefined}
        >
          {rim.lines.map((line, i) => (
            <polyline key={i} points={line} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      ))}
    </div>
  );
}

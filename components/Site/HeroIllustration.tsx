import type { CSSProperties } from "react";

const subject = (name: string, part = "") => ({ fill: `var(--subject-${name}${part})` }) satisfies CSSProperties;

/** 題目列：一個作答括號＋長短不一的題目線。 */
function QuestionRow({ y, width, done = false }: { y: number; width: number; done?: boolean }) {
  return (
    <g>
      <rect x="26" y={y - 7} width="16" height="14" rx="4" className="fill-none stroke-border-hairline" strokeWidth="2" />
      {done && <path d={`M29 ${y} l4 4 l7 -8`} className="fill-none stroke-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      <rect x="52" y={y - 4} width={width} height="8" rx="4" className="fill-base-300" />
    </g>
  );
}

/** 首頁主視覺：兩張疊在一起、冒著泡泡的考卷（延續 logo 的概念），顏色跟著亮暗主題。 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 420" className={className} aria-hidden="true">
      {/* 後面那張：英語卷 */}
      <g transform="rotate(-7 190 230)">
        <rect x="60" y="80" width="250" height="310" rx="22" className="fill-card stroke-border-hairline" strokeWidth="2" />
        <rect x="60" y="80" width="250" height="56" rx="22" style={subject("english", "-tint")} />
        <rect x="60" y="112" width="250" height="24" style={subject("english", "-tint")} />
        <rect x="84" y="100" width="92" height="14" rx="7" style={subject("english")} />
        {[168, 206, 244, 282, 320].map((y, index) => (
          <rect key={y} x="84" y={y} width={index % 2 ? 150 : 190} height="9" rx="4.5" className="fill-base-300" />
        ))}
      </g>

      {/* 前面那張：數學卷，有作答勾勾 */}
      <g transform="rotate(5 300 220)">
        <g transform="translate(170 50)">
          <rect width="260" height="320" rx="22" className="fill-card stroke-border-hairline" strokeWidth="2" style={{ filter: "drop-shadow(0 18px 30px oklch(0.45 0.08 250 / 0.18))" }} />
          <rect width="260" height="60" rx="22" style={subject("math", "-tint")} />
          <rect y="36" width="260" height="24" style={subject("math", "-tint")} />
          <rect x="26" y="20" width="104" height="16" rx="8" style={subject("math")} />
          <circle cx="222" cy="30" r="15" className="fill-card" />
          <text x="222" y="36" textAnchor="middle" fontSize="17" fontWeight="700" style={subject("math")}>
            A+
          </text>
          <QuestionRow y={98} width={170} done />
          <QuestionRow y={136} width={130} done />
          <QuestionRow y={174} width={182} />
          <QuestionRow y={212} width={110} done />
          <rect x="26" y="244" width="208" height="52" rx="12" className="fill-accent-tint" />
          <rect x="40" y="262" width="120" height="8" rx="4" className="fill-primary" opacity="0.45" />
          <rect x="40" y="278" width="80" height="8" rx="4" className="fill-primary" opacity="0.3" />
        </g>
      </g>

      {/* 泡泡 */}
      <g className="motion-safe:animate-float">
        <circle cx="408" cy="70" r="30" className="fill-secondary" />
        <circle cx="398" cy="60" r="8" className="fill-white" opacity="0.7" />
      </g>
      <g className="motion-safe:animate-float" style={{ animationDelay: "-2s" }}>
        <circle cx="446" cy="18" r="13" className="fill-primary" />
        <circle cx="442" cy="14" r="3.5" className="fill-white" opacity="0.7" />
      </g>
      <g className="motion-safe:animate-float" style={{ animationDelay: "-4s" }}>
        <circle cx="44" cy="120" r="16" className="fill-primary" opacity="0.25" />
        <circle cx="88" cy="46" r="9" className="fill-secondary" opacity="0.5" />
        <circle cx="120" cy="392" r="12" style={subject("social-studies")} opacity="0.55" />
      </g>
    </svg>
  );
}

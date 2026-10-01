import { siGithub, siNodedotjs } from 'simple-icons';

// Original marks used in the clone (not the real Railway / GitHub / Node brand assets).

type P = { size?: number; className?: string; title?: string };

/** Rail-track mark used in place of the brand logo. */
export function LogoMark({ size = 24, className, title = 'Railway Logo' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-label={title} role="img">
      <rect x="0.75" y="0.75" width="22.5" height="22.5" rx="11.25" fill="#fff" />
      <path d="M9.3 5.2 7.4 18.8M14.7 5.2l1.9 13.6" stroke="#13111c" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.3 9.3h7.4M7.8 13.2h8.4M7.4 16.9h9.2" stroke="#13111c" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** GitHub mark (simple-icons, CC0) for repo-backed services. */
export function RepoIcon({ size = 24, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="#fff">
      <path d={siGithub.path} />
    </svg>
  );
}

/** Node.js mark (simple-icons, CC0) for "node @ x.y.z". */
export function RuntimeIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill={`#${siNodedotjs.hex}`}>
      <path d={siNodedotjs.path} />
    </svg>
  );
}

/** Builder badge (box) used in the deployment details. */
export function BuilderIcon({ size = 20, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="1" y="1" width="18" height="18" rx="5" fill="#2b2140" />
      <path d="M10 4.5 15 7.2v5.6L10 15.5 5 12.8V7.2L10 4.5Z" stroke="#bf93ec" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.3 7.4 10 10l4.7-2.6M10 10v5.2" stroke="#bf93ec" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** The little status ring used on the canvas node ("Online"). */
export function OnlineDot({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="#42946e" strokeOpacity="0.13" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" fill="#42946e" />
    </svg>
  );
}

/** Badge that sits on top of the commit author avatar. */
export function SourceBadge({ size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="-2.5 -2.5 29 29" aria-hidden fill="#fff">
      <path d={siGithub.path} />
    </svg>
  );
}

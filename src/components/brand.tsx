import { siGithub, siNodedotjs } from 'simple-icons';

// Original marks used in the app (not the real GitHub / Node brand assets).

type P = { size?: number; className?: string; title?: string };

/** Lion-head mark used as the LikeLion brand logo. */
export function LogoMark({ size = 24, className, title = 'LikeLion Logo' }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-label={title} role="img">
      <g fill="#ffa41b">
        <circle cx="5.4" cy="5.9" r="2.7" />
        <circle cx="18.6" cy="5.9" r="2.7" />
        <circle cx="12.00" cy="19.40" r="3.3" />
        <circle cx="7.24" cy="17.67" r="3.3" />
        <circle cx="4.71" cy="13.28" r="3.3" />
        <circle cx="5.59" cy="8.30" r="3.3" />
        <circle cx="9.47" cy="5.05" r="3.3" />
        <circle cx="14.53" cy="5.05" r="3.3" />
        <circle cx="18.41" cy="8.30" r="3.3" />
        <circle cx="19.29" cy="13.28" r="3.3" />
        <circle cx="16.76" cy="17.67" r="3.3" />
        <circle cx="12" cy="12" r="8.2" />
      </g>
      <g fill="#ffffff">
        <circle cx="5.4" cy="5.9" r="1.1" />
        <circle cx="18.6" cy="5.9" r="1.1" />
        <circle cx="12" cy="12.4" r="5.9" />
      </g>
      <g fill="#191f28">
        <circle cx="9.7" cy="11" r="0.95" />
        <circle cx="14.3" cy="11" r="0.95" />
        <path d="M10.6 13.1h2.8l-1.4 1.6z" />
      </g>
      <path d="M12 14.7v1c-.5.9-1.7 1.1-2.4.3M12 15.7c.5.9 1.7 1.1 2.4.3" stroke="#191f28" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** GitHub mark (simple-icons, CC0) for repo-backed services. */
export function RepoIcon({ size = 24, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
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
      <rect x="1" y="1" width="18" height="18" rx="5" fill="#fff4e0" />
      <path d="M10 4.5 15 7.2v5.6L10 15.5 5 12.8V7.2L10 4.5Z" stroke="#e08600" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.3 7.4 10 10l4.7-2.6M10 10v5.2" stroke="#e08600" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** The little status ring used on the canvas node ("Online"). */
export function OnlineDot({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="#03b26c" strokeOpacity="0.13" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" fill="#03b26c" />
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

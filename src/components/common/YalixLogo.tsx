import React from 'react';

export interface YalixLogoProps {
  /** Size preset: sm (sidebar/compact), md (default/standard), lg (login header), xl (hero/display) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional variant: 'full' for complete wordmark with angular lines, 'mark' for the Y monogram emblem */
  variant?: 'full' | 'mark';
  /** Additional custom Tailwind CSS classes */
  className?: string;
  /** Whether to wrap in a subtle accessible container */
  ariaLabel?: string;
}

const BRAND_BLUE = '#0052B4';

/**
 * Official YALIX CSS/SVG Vector Logo Component
 * - Clean, sharp vector typography (no blurry image files)
 * - Exact royal blue brand color (#0052B4)
 * - Modern heavy sans-serif uppercase italic lettering
 * - Dynamic angular speed-lines framing the wordmark
 * - Infinitely sharp at any display resolution (1x, 2x Retina, 4K)
 */
export const YalixLogo: React.FC<YalixLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
  ariaLabel = 'YALIX CRM',
}) => {
  // Sizing styles for the full wordmark
  const fullSizeClasses = {
    sm: 'w-28 sm:w-32 h-auto',
    md: 'w-44 sm:w-52 h-auto',
    lg: 'w-56 sm:w-64 h-auto',
    xl: 'w-72 sm:w-80 h-auto',
  };

  // Sizing styles for the mark/monogram
  const markSizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`select-none shrink-0 ${markSizeClasses[size]} ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Background rounded squircle */}
        <rect width="100" height="100" rx="22" fill="#FFFFFF" />
        <rect width="100" height="100" rx="22" fill="none" stroke="#E2E8F0" strokeWidth="1.5" />

        {/* Top angular speed-line */}
        <path
          d="M 28 22 L 78 22 L 68 30 L 18 30 Z"
          fill={BRAND_BLUE}
        />

        {/* Monogram stylized Y */}
        <text
          x="30"
          y="72"
          style={{
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Liberation Sans", Arial, sans-serif',
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: '56px',
            fill: BRAND_BLUE,
            letterSpacing: '-1px',
          }}
        >
          Y
        </text>

        {/* Bottom angular speed-line */}
        <path
          d="M 12 78 L 64 78 L 74 68 L 84 68 L 72 84 L 8 84 Z"
          fill={BRAND_BLUE}
        />
      </svg>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        viewBox="0 0 560 140"
        className={`w-full h-auto overflow-visible ${fullSizeClasses[size]}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <style>
            {`
              .yalix-logo-text {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Liberation Sans", Arial, sans-serif;
                font-weight: 900;
                font-style: italic;
                font-size: 86px;
                fill: ${BRAND_BLUE};
                letter-spacing: -1.5px;
                text-rendering: geometricPrecision;
              }
              .yalix-logo-shape {
                fill: ${BRAND_BLUE};
                shape-rendering: geometricPrecision;
              }
            `}
          </style>
        </defs>

        {/* Top angular blue line: starts above 'A', runs across 'A','L','I', angles up-right above 'X' */}
        <path
          className="yalix-logo-shape"
          d="
            M 188 28 
            L 375 28 
            L 435 14 
            L 542 14 
            L 537 21 
            L 438 21 
            L 380 35 
            L 185 35 
            Z
          "
        />

        {/* YALIX Wordmark in bold, uppercase, italic lettering */}
        <text x="105" y="96" className="yalix-logo-text">
          YALIX
        </text>

        {/* Bottom angular blue line: starts left of 'Y', runs under word, angles up-right under 'X' */}
        <path
          className="yalix-logo-shape"
          d="
            M 28 108 
            L 338 108 
            L 368 88 
            L 378 88 
            L 345 115 
            L 25 115 
            Z
          "
        />
      </svg>
    </div>
  );
};

export default YalixLogo;

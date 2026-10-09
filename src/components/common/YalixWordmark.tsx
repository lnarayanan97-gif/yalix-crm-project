import React from 'react';

export interface YalixWordmarkProps {
  /** Size preset: sm (sidebar header), md (standard), lg (login header), xl (loading screen / display) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional custom Tailwind CSS classes */
  className?: string;
  /** Optional accessible label */
  ariaLabel?: string;
  /** Whether to apply a subtle, crisp cyber blue glow (default: true) */
  glow?: boolean;
}

/**
 * Premium Futuristic Technology Wordmark: "YALIX"
 * - Clean text-only presentation (zero images, icons, boxes, or lines)
 * - Geometric futuristic typeface: Orbitron (weights 800/900)
 * - Exact royal blue brand color: #1556B5
 * - Precise 2px letter spacing
 * - Subtle clarity-preserving cyan/royal blue ambient tech glow
 */
export const YalixWordmark: React.FC<YalixWordmarkProps> = ({
  size = 'md',
  className = '',
  ariaLabel = 'YALIX',
  glow = true,
}) => {
  const sizeClasses = {
    sm: 'text-lg sm:text-xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-3xl sm:text-4xl md:text-5xl',
    xl: 'text-4xl sm:text-5xl md:text-6xl',
  };

  const glowStyle = glow
    ? {
        textShadow:
          '0 0 16px rgba(21, 86, 181, 0.45), 0 0 2px rgba(21, 86, 181, 0.9)',
      }
    : undefined;

  return (
    <span
      className={`font-black uppercase select-none text-[#1556B5] tracking-[2px] leading-none inline-block ${sizeClasses[size]} ${className}`}
      style={{
        fontFamily:
          "'Orbitron', 'Rajdhani', 'Eurostile', 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontWeight: 900,
        letterSpacing: '2px',
        ...glowStyle,
      }}
      role="img"
      aria-label={ariaLabel}
    >
      YALIX
    </span>
  );
};

export default YalixWordmark;

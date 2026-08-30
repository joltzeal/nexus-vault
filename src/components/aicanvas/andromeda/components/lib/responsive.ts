'use client';

import { useEffect, useState } from 'react';
import { tokens } from '../../tokens';

const bp = tokens.breakpoints; // { sm: '640px', md: '768px', lg: '1024px' }

/**
 * breakpointPx — numeric (px) thresholds for JS comparisons. Parsed once
 * from the same tokens the `mq` strings interpolate, so CSS and JS branch
 * at identical widths.
 */
export const breakpointPx = {
  sm: parseInt(bp.sm, 10),
  md: parseInt(bp.md, 10),
  lg: parseInt(bp.lg, 10),
};

/**
 * mq — media-query strings built from the breakpoint tokens. Drop into a
 * template-string <style> block. Desktop-first: the bare rule is the
 * desktop layout; the `mq.md` block is the stacked phone/small-tablet
 * override.
 *
 *   import { mq } from '../../components/lib/responsive';
 *
 *   <div className="mc-grid">…</div>
 *   <style>{`
 *     .mc-grid {
 *       display: grid;
 *       grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
 *       gap: ${tokens.spacing[3]};
 *     }
 *     ${mq.md} { .mc-grid { grid-template-columns: minmax(0, 1fr); } }
 *   `}</style>
 *
 * `coarse` targets touch devices regardless of width — use it to grow
 * hit targets without changing the desktop visual size.
 */
export const mq = {
  sm: `@media (max-width: ${bp.sm})`,
  md: `@media (max-width: ${bp.md})`,
  lg: `@media (max-width: ${bp.lg})`,
  coarse: '@media (pointer: coarse)',
};

/**
 * useBreakpoint — current viewport bucket. Defaults to DESKTOP on the
 * server and the first client render so SSR markup matches the
 * desktop-first CSS, then corrects in an effect after mount.
 *
 * Use ONLY when the DOM must branch in JS. For pure style reflow (and
 * even most structural swaps — render both and CSS-hide the inactive one)
 * prefer the `mq` mechanism, which has no hydration flash.
 *
 *   const { isMobile } = useBreakpoint(); // ≤ md (768px)
 *   if (isMobile) { … }
 *
 * @returns {{ width: number|null, isMobile: boolean, isTablet: boolean, isDesktop: boolean }}
 */
export function useBreakpoint() {
  // null = "not yet measured" → assume desktop (matches SSR + the
  // desktop-first CSS base). Corrected to the real width on mount.
  const [width, setWidth] = useState(null);

  useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  const w = width ?? breakpointPx.lg + 1; // assume desktop until measured

  return {
    width,
    isMobile: w <= breakpointPx.md, // ≤ 768 → stacked layout / drawer nav
    isTablet: w > breakpointPx.md && w <= breakpointPx.lg,
    isDesktop: w > breakpointPx.lg,
  };
}

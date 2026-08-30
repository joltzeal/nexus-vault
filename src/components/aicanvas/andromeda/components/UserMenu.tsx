// @ts-nocheck
'use client';

import { createPortal } from 'react-dom';
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CaretUpDown } from '@phosphor-icons/react';
import { tokens } from '../tokens';
import { Avatar } from './Avatar';
import { andromedaVars } from './lib/utils';
import { mq } from './lib/responsive';

// Motion locals — framer-motion takes seconds + a 4-tuple bezier, but
// `tokens.motion` exposes ms strings and CSS cubic-bezier() strings.
// These two helpers keep every value traceable to a token while
// adapting to framer's shape (same convention as Drawer.tsx).
const toSeconds = (ms) => parseInt(ms, 10) / 1000;
const EASE_STANDARD = [0.4, 0, 0.2, 1]; // tokens.motion.easing.standard

// Roving arrow-key navigation for the `role="menu"` panel. Queries the
// menuitem buttons, finds the focused one, and moves focus up/down with
// wrap-around; Home/End jump to first/last. Separators are ignored because
// they are not `role="menuitem"` buttons. Bound to the panel's onKeyDown.
function handleMenuKeyDown(e) {
  const itemsList = Array.from(
    e.currentTarget.querySelectorAll('button[role="menuitem"]'),
  );
  if (itemsList.length === 0) return;
  const idx = itemsList.indexOf(document.activeElement);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    itemsList[idx < 0 ? 0 : (idx + 1) % itemsList.length].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    itemsList[idx < 0 ? itemsList.length - 1 : (idx - 1 + itemsList.length) % itemsList.length].focus();
  } else if (e.key === 'Home') {
    e.preventDefault();
    itemsList[0].focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    itemsList[itemsList.length - 1].focus();
  }
}

/**
 * @typedef {object} UserMenuItem
 * @property {string}   [id]           Stable key for the row, falling back to its array index.
 * @property {string}   [label]        Text shown on the menu item, rendered uppercase.
 * @property {React.ComponentType<{ size?: number, weight?: string }>} [icon] Icon component rendered before the label.
 * @property {() => void} [onSelect]   Handler called when the item is chosen; the menu closes after.
 * @property {React.ReactNode} [trailing] Optional trailing control, such as a Toggle.
 * @property {boolean} [closeOnSelect=true] Keep the panel open after selecting the item.
 * @property {boolean} [disabled=false] Disables the item.
 * @property {boolean}  [destructive]  Renders the item in the destructive red color.
 * @property {'separator'} [type]      Set to 'separator' to render a divider instead of an item.
 */

/**
 * Shared state hook — owns the open/close lifecycle, the wrapper ref,
 * and the listeners for outside-click + Escape. Used by both
 * `UserMenu` and `UserCard` so the trigger behavior stays identical.
 *
 * `initialOpen` lets callers render the menu pre-opened (showcases /
 * docs); outside-click and Escape still dismiss it.
 *
 * `staticOpen` pins the panel open: the outside-click + Escape dismissers
 * are not attached, so it survives clicks elsewhere on the page. For
 * showcases / docs where several popovers are shown open at once and one
 * must not close the others. The trigger can still toggle it.
 */
export function useUserMenuPanel(initialOpen = false, staticOpen = false) {
  const [open, setOpen] = useState(initialOpen || staticOpen);
  const wrapperRef = useRef(null);
  const panelRef = useRef(null);
  // The element to return focus to on close — captured when the trigger
  // toggles the menu open (interactive open only).
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open || staticOpen) return;
    const onClick = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      ) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, staticOpen]);

  // Focus the first menuitem when the panel opens — NEVER in staticOpen mode,
  // where multiple pinned menus would fight over focus. Queried from the
  // wrapper (which both UserMenu and UserCard set) so the panel ref does not
  // need threading through every trigger component.
  useEffect(() => {
    if (!open || staticOpen) return;
    const first = wrapperRef.current?.querySelector('[role="menu"] button[role="menuitem"]');
    if (first) first.focus();
  }, [open, staticOpen]);

  // Return focus to the trigger when the panel closes after an interactive
  // open. Skipped in staticOpen mode (no focus stealing on showcase pages).
  useEffect(() => {
    if (open || staticOpen) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target) target.focus();
  }, [open, staticOpen]);

  const toggle = (e) => {
    // Capture the trigger as the focus-return target before opening.
    if (!open && !staticOpen) {
      returnFocusRef.current = e?.currentTarget ?? document.activeElement;
    }
    setOpen((o) => !o);
  };
  const close = () => setOpen(false);
  const triggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'data-state': open ? 'open' : 'closed',
    onClick: toggle,
  };

  return { open, toggle, close, panelRef, wrapperRef, triggerProps };
}

function usePortalPosition(open, enabled, placement, align, wrapperRef) {
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open || !enabled) return undefined;
    const update = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = parseInt(tokens.spacing[2], 10);
      const width = 200;
      const left = align === 'end'
        ? Math.max(8, rect.right - width)
        : Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

      setPosition(
        placement === 'top'
          ? { bottom: Math.max(8, window.innerHeight - rect.top + gap), left }
          : { left, top: Math.min(window.innerHeight - 8, rect.bottom + gap) },
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [align, enabled, open, placement, wrapperRef]);

  return position;
}

function UserMenuItemRow({ item, onClose }) {
  if (item.type === 'separator') {
    return (
      <div
        role="separator"
        style={{
          height: '1px',
          margin: `${tokens.spacing[1]} 0`,
          background: tokens.color.border.subtle,
        }}
      />
    );
  }
  const Icon = item.icon;
  const baseColor = item.destructive ? tokens.color.red[300] : tokens.color.text.secondary;
  const handleSelect = () => {
    item.onSelect?.();
    if (item.closeOnSelect !== false) onClose();
  };
  return (
    <div
      className="andromeda-user-menu-item-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <button
        type="button"
        role="menuitem"
        aria-disabled={item.disabled ? 'true' : undefined}
        disabled={item.disabled}
        onClick={handleSelect}
        className="andromeda-user-menu-item"
        data-destructive={item.destructive ? 'true' : 'false'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[3],
          flex: 1,
          minWidth: 0,
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          background: 'transparent',
          border: 'none',
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          fontFamily: tokens.typography.fontMono,
          fontSize: tokens.typography.size.xs,
          fontWeight: tokens.typography.weight.medium,
          color: baseColor,
          textAlign: 'left',
          textTransform: 'uppercase',
          letterSpacing: tokens.typography.tracking.wide,
          whiteSpace: 'nowrap',
          opacity: item.disabled ? 0.45 : 1,
          transition: `background ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}, color ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
        }}
      >
        {Icon ? <Icon size={14} weight="regular" /> : <span style={{ width: '14px' }} />}
        <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
      </button>
      {item.trailing ? (
        <span
          onClick={(event) => event.stopPropagation()}
          style={{ paddingRight: tokens.spacing[2] }}
        >
          {item.trailing}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Shared panel — renders the floating menu surface and its items.
 * Visibility, placement, and alignment are controlled by props so
 * each trigger component can pick its own canonical defaults.
 */
export function UserMenuPanel({ open, items, placement = 'bottom', align = 'start', panelMinWidth = 200, ariaLabel = 'User menu', onClose, panelRef, portalPosition, surface }) {
  if (!open) return null;
  const vertical =
    placement === 'top'
      ? { bottom: `calc(100% + ${tokens.spacing[2]})` }
      : { top: `calc(100% + ${tokens.spacing[2]})` };
  const horizontal =
    align === 'stretch'
      ? { left: 0, right: 0 }
      : align === 'end'
        ? { right: 0 }
        : { left: 0 };
  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={ariaLabel}
      onKeyDown={handleMenuKeyDown}
      className="andromeda-user-menu-panel"
      data-align={align}
      style={{
        position: portalPosition ? 'fixed' : 'absolute',
        ...(portalPosition ?? { ...vertical, ...horizontal }),
        minWidth: `${panelMinWidth}px`,
        // Cap to a token-inset of the viewport so the absolutely-positioned
        // panel can never push past the screen and force horizontal page
        // scroll on a phone. box-sizing keeps the border inside that cap.
        maxWidth: `calc(100vw - ${tokens.spacing[4]})`,
        boxSizing: 'border-box',
        ...(surface ? { '--andromeda-surface-hover': surface } : {}),
        background: surface ?? tokens.color.surface.raised,
        border: `${tokens.border.thin} ${tokens.color.border.base}`,
        borderRadius: tokens.radius.frame,
        padding: tokens.spacing[1],
        zIndex: 1000,
        boxShadow: 'var(--andromeda-shadow-md, 0 8px 21.6px rgba(0, 0, 0, 0.45))',
      }}
    >
      {items.map((item, i) => (
        <UserMenuItemRow key={item.id ?? i} item={item} onClose={onClose} />
      ))}
    </div>
  );
}

// Hover/focus styles for the menuitem buttons. Marked `!important`
// because the buttons carry inline `style={{ background:'transparent' }}`
// which would otherwise beat any non-important class rule — same
// precedence trap covered in the Andromeda interaction-states rules.
function UserMenuStyles() {
  return (
    <style>{`
      .andromeda-user-menu-item:hover {
        background: var(--andromeda-surface-hover) !important;
        color: var(--andromeda-text-primary) !important;
      }
      .andromeda-user-menu-item[data-destructive="true"]:hover {
        background: var(--andromeda-surface-hover) !important;
        color: var(--andromeda-red-200) !important;
      }
      .andromeda-user-menu-item:active {
        background: var(--andromeda-surface-active) !important;
      }
      .andromeda-user-menu-item:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 1px var(--andromeda-accent-400);
      }
      /* Phone fit — a start-aligned (left:0) panel anchored to a trigger that
         sits in the right half of a phone would open off the right edge. Below
         sm, pin it to the trigger's RIGHT edge instead so it stays on-screen.
         stretch (left:0 + right:0) and end (right:0) are already viewport-safe.
         !important: left/right are inline styles (the Andromeda interaction-states rules). */
      ${mq.sm} {
        .andromeda-user-menu-panel[data-align="start"] {
          left: auto !important;
          right: 0 !important;
        }
      }
    `}</style>
  );
}

// Export so UserCard can mount the same stylesheet without
// duplicating it. Both components must end up with the same
// selectors active or hover state will silently regress.
export { UserMenuStyles };

/**
 * @typedef {object} UserMenuProps
 * @property {string} name             Display name; passed to Avatar for the initial fallback.
 * @property {string} [src]            Avatar image URL.
 * @property {'online'|'busy'|'away'|'offline'} [status] Presence state; passed to Avatar for the status dot.
 * @property {'sm'|'md'|'lg'} [avatarSize='md'] Size of the trigger avatar.
 * @property {UserMenuItem[]} items The menu rows to render, including separators.
 * @property {'top'|'bottom'} [placement='bottom'] Whether the panel opens below or above the trigger.
 * @property {'start'|'end'} [align='end'] Which trigger edge the panel aligns to horizontally.
 * @property {boolean} [defaultOpen=false] Render the menu pre-opened (showcases / docs). Outside-click and Escape still dismiss it.
 * @property {boolean} [staticOpen=false] Render pre-opened AND pinned; outside-click / Escape do not dismiss it. For showcases / docs where several popovers are shown open at once and one must not close the others.
 * @property {string} [ariaLabel='User menu'] Accessible label for the trigger button and menu panel.
 * @property {string} [className] Class name applied to the wrapper element.
 * @property {React.CSSProperties} [style] Inline styles merged onto the wrapper element.
 * @property {boolean} [portal=false] Render the panel in the document portal to escape clipping ancestors.
 * @property {string} [surface] Background shared by the trigger and panel when open.
 * @property {boolean} [showCaret=true] Whether the trigger displays its menu indicator.
 */

/** @type {React.ForwardRefExoticComponent<UserMenuProps>} */
export const UserMenu = forwardRef<any, any>(function UserMenu(
  {
    name,
    src,
    status,
    avatarSize = 'md',
    items,
    placement = 'bottom',
    align = 'end',
    defaultOpen = false,
    staticOpen = false,
    ariaLabel = 'User menu',
    className,
    portal = false,
    showCaret = true,
    surface,
    style,
    ...props
  },
  ref,
) {
  const { open, panelRef, wrapperRef, triggerProps, close } = useUserMenuPanel(defaultOpen, staticOpen);
  const [hover, setHover] = useState(false);
  const highlight = open || hover;
  const portalPosition = usePortalPosition(open, portal, placement, align, wrapperRef);
  const panel = (
    <UserMenuPanel
      open={open}
      items={items}
      placement={placement}
      align={align}
      ariaLabel={ariaLabel}
      onClose={close}
      panelRef={panelRef}
      portalPosition={portal ? portalPosition : undefined}
      surface={surface}
    />
  );

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      data-slot="user-menu"
      className={className}
      style={{ ...andromedaVars(), position: 'relative', display: 'inline-flex', ...style }}
      {...props}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        {...triggerProps}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          cursor: 'pointer',
          background: highlight ? (surface ?? tokens.color.surface.hover) : 'transparent',
          transition: `background ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
        }}
      >
        <Avatar name={name} src={src} status={status} size={avatarSize} />
        {showCaret ? (
          <motion.span
            aria-hidden
            animate={{ rotate: open ? 180 : 0 }}
            transition={{
              duration: toSeconds(tokens.motion.duration.normal),
              ease: EASE_STANDARD,
            }}
            style={{
              display: 'inline-flex',
              color: highlight ? tokens.color.text.secondary : tokens.color.text.faint,
              transition: `color ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
            }}
          >
            <CaretUpDown size={14} weight="regular" />
          </motion.span>
        ) : null}
      </button>

      {portal && typeof document !== 'undefined' ? createPortal(panel, document.body) : panel}
      <UserMenuStyles />
    </div>
  );
});

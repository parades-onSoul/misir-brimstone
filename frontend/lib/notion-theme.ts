/**
 * Notion-Inspired Design System
 * Color palette, typography, and design tokens matching Notion's aesthetic
 */

export const notionColors = {
  // Background colors (Notion's layered approach)
  bg: {
    primary: 'rgb(255, 255, 255)',
    secondary: 'rgb(247, 246, 243)',
    tertiary: 'rgb(242, 241, 238)',
    hover: 'rgba(55, 53, 47, 0.08)',
    selected: 'rgba(35, 131, 226, 0.14)',
  },
  
  // Dark mode backgrounds
  bgDark: {
    primary: 'rgb(25, 25, 25)',
    secondary: 'rgb(32, 32, 32)',
    tertiary: 'rgb(37, 37, 37)',
    hover: 'rgba(255, 255, 255, 0.055)',
    selected: 'rgba(46, 170, 220, 0.15)',
  },
  
  // Text colors
  text: {
    primary: 'rgb(55, 53, 47)',
    secondary: 'rgba(55, 53, 47, 0.65)',
    tertiary: 'rgba(55, 53, 47, 0.45)',
    placeholder: 'rgba(55, 53, 47, 0.4)',
  },
  
  textDark: {
    primary: 'rgba(255, 255, 255, 0.9)',
    secondary: 'rgba(255, 255, 255, 0.6)',
    tertiary: 'rgba(255, 255, 255, 0.4)',
    placeholder: 'rgba(255, 255, 255, 0.3)',
  },
  
  // Accent colors
  accent: {
    blue: 'rgb(35, 131, 226)',
    blueHover: 'rgb(28, 117, 202)',
    red: 'rgb(235, 87, 87)',
    orange: 'rgb(255, 163, 68)',
    yellow: 'rgb(255, 220, 73)',
    green: 'rgb(68, 207, 110)',
    purple: 'rgb(154, 109, 215)',
    pink: 'rgb(249, 132, 239)',
    brown: 'rgb(159, 108, 76)',
    gray: 'rgb(155, 154, 151)',
  },
  
  // Border colors
  border: {
    light: 'rgba(55, 53, 47, 0.09)',
    medium: 'rgba(55, 53, 47, 0.16)',
    dark: 'rgba(55, 53, 47, 0.24)',
  },
  
  borderDark: {
    light: 'rgba(255, 255, 255, 0.055)',
    medium: 'rgba(255, 255, 255, 0.094)',
    dark: 'rgba(255, 255, 255, 0.145)',
  },
  
  // Semantic colors
  semantic: {
    success: 'rgb(68, 207, 110)',
    warning: 'rgb(255, 163, 68)',
    error: 'rgb(235, 87, 87)',
    info: 'rgb(35, 131, 226)',
  },
};

export const notionTypography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '0.9375rem', // 15px (Notion default)
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
};

export const notionSpacing = {
  sidebar: {
    width: '240px',
    widthExpanded: '280px',
    widthCollapsed: '0px',
  },
  page: {
    maxWidth: '900px',
    padding: '96px 24px 40px',
    paddingMobile: '60px 16px 24px',
  },
  gutter: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
};

export const notionShadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
  md: '0 2px 8px rgba(0, 0, 0, 0.08)',
  lg: '0 4px 16px rgba(0, 0, 0, 0.12)',
  xl: '0 8px 32px rgba(0, 0, 0, 0.16)',
  
  // Notion-specific shadows
  card: 'rgba(15, 15, 15, 0.1) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 2px 4px',
  cardHover: 'rgba(15, 15, 15, 0.1) 0px 0px 0px 1px, rgba(15, 15, 15, 0.2) 0px 3px 9px',
  modal: 'rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px',
};

export const notionBorderRadius = {
  none: '0',
  sm: '3px',
  md: '4px',
  lg: '6px',
  xl: '8px',
  full: '9999px',
};

export const notionTransitions = {
  fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Notion-specific easing
  notion: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
};

/**
 * CSS-in-JS helper for Notion-style hover states
 */
export const notionHoverState = {
  light: `
    transition: background-color 20ms ease-in-out;
    &:hover {
      background-color: rgba(55, 53, 47, 0.08);
    }
  `,
  dark: `
    transition: background-color 20ms ease-in-out;
    &:hover {
      background-color: rgba(255, 255, 255, 0.055);
    }
  `,
};

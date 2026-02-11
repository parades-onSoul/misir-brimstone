/**
 * Misir Animation System - Linear Edition
 * 
 * Core animation configurations for achieving the "Linear feel":
 * - Fast (150-250ms)
 * - Tight movements (4-8px)
 * - Subtle scale changes (0.95-1.0)
 */

/**
 * The "Linear" transition config
 * Snappy start, soft landing
 */
export const linearTransition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // Custom bezier curve (easeOutCubic variant)
};

/**
 * For list items - extremely tight stagger
 */
export const linearStagger = 0.03; // 30ms between items

/**
 * For modals/dialogs - spring physics
 */
export const springConfig = {
  type: "spring" as const,
  damping: 25,
  stiffness: 300,
};

/**
 * For micro-interactions (buttons, toggles)
 */
export const microTransition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

/**
 * Page entrance animation variants
 */
export const pageVariants = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4 },
};

/**
 * List container variants
 */
export const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: linearStagger,
    },
  },
};

/**
 * List item variants
 */
export const listItemVariants = {
  hidden: { opacity: 0, y: 5 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

/**
 * Modal/Dialog variants
 */
export const modalOverlayVariants = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  show: {
    opacity: 1,
    backdropFilter: "blur(4px)",
    transition: { duration: 0.2 },
  },
};

export const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springConfig,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 4,
    transition: { duration: 0.15 },
  },
};

/**
 * Command Palette variants (no scale, feels more "summoned")
 */
export const paletteVariants = {
  hidden: { opacity: 0, y: -20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

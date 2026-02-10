"use client";

/**
 * PageEntrance Component
 * 
 * Subtle upward drift animation for page transitions.
 * Pages should "appear" rather than "whoosh" in.
 */

import { motion } from "framer-motion";
import { linearTransition, pageVariants } from "@/lib/animation";

interface PageEntranceProps {
  children: React.ReactNode;
}

export const PageEntrance = ({ children }: PageEntranceProps) => (
  <motion.div
    initial={pageVariants.initial}
    animate={pageVariants.animate}
    exit={pageVariants.exit}
    transition={linearTransition}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);

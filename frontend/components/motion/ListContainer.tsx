"use client";

/**
 * ListContainer & ListItem Components
 * 
 * High-speed staggered list animations for Artifacts and Search views.
 * Items flow in like a waterfall with extremely tight timing (30ms).
 */

import { motion } from "framer-motion";
import {
  listContainerVariants,
  listItemVariants,
} from "@/lib/animation";

interface ListContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const ListContainer = ({ children, className }: ListContainerProps) => (
  <motion.ul
    variants={listContainerVariants}
    initial="hidden"
    animate="show"
    className={className}
  >
    {children}
  </motion.ul>
);

interface ListItemProps {
  children: React.ReactNode;
}

export const ListItem = ({ children }: ListItemProps) => (
  <motion.li variants={listItemVariants}>{children}</motion.li>
);

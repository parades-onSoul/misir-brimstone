"use client";

/**
 * Modal Component
 * 
 * Dialogs scale up slightly from center with spring physics.
 * No massive bounces - just a subtle "pop" feel.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  modalOverlayVariants,
  modalContentVariants,
} from "@/lib/animation";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Modal = ({ isOpen, onClose, children, className }: ModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          variants={modalOverlayVariants}
          initial="hidden"
          animate="show"
          exit="hidden"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />

        {/* Content */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={modalContentVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className={className}
          >
            {children}
          </motion.div>
        </div>
      </>
    )}
  </AnimatePresence>
);

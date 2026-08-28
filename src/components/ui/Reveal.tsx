"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Use mount animation when the block is already on screen (e.g. hero). */
  onMount?: boolean;
};

export function Reveal({ children, className, onMount = false }: RevealProps) {
  if (onMount) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05, margin: "80px" }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}

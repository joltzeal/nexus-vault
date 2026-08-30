"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const TYPE_SPEED = 55;
const DELETE_SPEED = 28;
const HOLD_TIME = 850;
const SWITCH_DELAY = 120;

export const previewTexts = [
  "build things that matter",
  "simplicity is the ultimate sophistication",
  "ship it. then make it better.",
  "who let the dogs out",
  "woff woff woff woff",
];

interface TerminalTextProps {
  texts?: string[];
  prefix?: string;
  className?: string;
}

type TypeState = {
  index: number;
  visibleLength: number;
  isDeleting: boolean;
};

function getNextState(state: TypeState, textLength: number, totalText: number) {
  const { index, visibleLength, isDeleting } = state;

  if (!isDeleting && visibleLength < textLength) {
    return {
      next: { ...state, visibleLength: visibleLength + 1 },
      delay: TYPE_SPEED,
    };
  }
  if (!isDeleting && visibleLength === textLength) {
    return { next: { ...state, isDeleting: true }, delay: HOLD_TIME };
  }
  if (isDeleting && visibleLength > 0) {
    return {
      next: { ...state, visibleLength: visibleLength - 1 },
      delay: DELETE_SPEED,
    };
  }
  return {
    next: {
      index: (index + 1) % totalText,
      visibleLength: 0,
      isDeleting: false,
    },
    delay: SWITCH_DELAY,
  };
}

export function TerminalText({
  texts = previewTexts,
  prefix,
  className = "text-emerald-600 dark:text-emerald-400",
}: TerminalTextProps) {
  const [state, setState] = useState<TypeState>({
    index: 0,
    visibleLength: 0,
    isDeleting: false,
  });

  const resolvedTexts = texts.length > 0 ? texts : previewTexts;
  const text = resolvedTexts[state.index % resolvedTexts.length];
  const visibleText = text.slice(0, state.visibleLength);

  useEffect(() => {
    const { next, delay } = getNextState(
      state,
      text.length,
      resolvedTexts.length
    );
    const id = setTimeout(() => setState(next), delay);
    return () => clearTimeout(id);
  }, [state, text, resolvedTexts.length]);

  return (
    <motion.div
      aria-live="polite"
      className={cn("flex items-center font-mono tracking-[0.08em]", className)}
    >
      <span className="whitespace-nowrap">
        {prefix && <span className="text-current/40">{prefix}</span>}
        {visibleText}
        <motion.span
          aria-hidden="true"
          animate={{ opacity: [1, 0, 1] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "linear",
          }}
          className="inline-block h-[1em] w-[0.6ch] translate-y-[0.1em] border-r-8 border-current align-[-0.15em]"
        />
      </span>
    </motion.div>
  );
}

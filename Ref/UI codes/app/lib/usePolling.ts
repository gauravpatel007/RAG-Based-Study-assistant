"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom hook for status polling.
 * @param callback - Function to execute for each poll.
 * @param delay - Interval in milliseconds (null to stop).
 */
export function usePolling(callback: () => void | Promise<void>, delay: number | null) {
  const savedCallback = useRef(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

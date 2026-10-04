import { useState, useEffect } from "react";

// Phones are under 768px; tablets (iPad portrait, small laptops) run up to
// 1100px; anything wider gets the full desktop layout.
const PHONE_MAX = 768;
const WIDE_MIN = 1100;

const read = () => {
  const width = window.innerWidth;
  return {
    isPhone: width < PHONE_MAX,
    isTablet: width >= PHONE_MAX && width < WIDE_MIN,
    isWide: width >= WIDE_MIN,
  };
};

export default function useViewport() {
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    const queries = [`(min-width: ${PHONE_MAX}px)`, `(min-width: ${WIDE_MIN}px)`].map((q) => window.matchMedia(q));
    const handler = () => setViewport(read());
    queries.forEach((mq) => mq.addEventListener("change", handler));
    return () => queries.forEach((mq) => mq.removeEventListener("change", handler));
  }, []);
  return viewport;
}

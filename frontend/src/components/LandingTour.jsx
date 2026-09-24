import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "../language/useLanguage.js";
import "./LandingTour.css";

// Space between the spotlight ring and its target, the gap to the coach card,
// and the minimum distance kept from the viewport edge.
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 16;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function LandingTour({ userName, targets, introductionLocked, onClose }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  // Tagged with its step so a previous step's measurement is never shown.
  const [measured, setMeasured] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);
  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const headingRef = useRef(null);

  const steps = [
    { id: "welcome", title: t("tour.welcome.title", { name: userName }), body: t("tour.welcome.body") },
    {
      id: "sessions",
      target: "sessions",
      title: t("tour.sessions.title"),
      body: introductionLocked ? t("tour.sessions.bodyLocked") : t("tour.sessions.body"),
    },
    { id: "inSession", title: t("tour.inSession.title"), body: t("tour.inSession.body"), showInputs: true },
    { id: "settings", target: "settings", title: t("tour.settings.title"), body: t("tour.settings.body") },
    { id: "caregiver", target: "caregiver", title: t("tour.caregiver.title"), body: t("tour.caregiver.body") },
  ];
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const targetEl = step.target ? targets[step.target]?.current : null;
  const rect = targetEl && measured?.index === index ? measured.rect : null;
  const positioned = !targetEl || Boolean(rect && cardPosition);

  useEffect(() => {
    targetEl?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    headingRef.current?.focus();
  }, [index, targetEl]);

  // Follow the target while the page scrolls into place or the window resizes.
  useLayoutEffect(() => {
    if (!targetEl) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { top, left, width, height } = targetEl.getBoundingClientRect();
        setMeasured({ index, rect: { top, left, width, height } });
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index, targetEl]);

  // Put the card below the target, else above it, else pinned to the bottom.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!rect || !card) {
      setCardPosition(null);
      return;
    }
    const { innerWidth, innerHeight } = window;
    const cardHeight = card.offsetHeight;
    const cardWidth = card.offsetWidth;
    const below = rect.top + rect.height + SPOTLIGHT_PADDING + CARD_GAP;
    const above = rect.top - SPOTLIGHT_PADDING - CARD_GAP - cardHeight;
    let top = innerHeight - cardHeight - VIEWPORT_MARGIN;
    if (below + cardHeight <= innerHeight - VIEWPORT_MARGIN) top = below;
    else if (above >= VIEWPORT_MARGIN) top = above;
    const centeredLeft = rect.left + rect.width / 2 - cardWidth / 2;
    const left = Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN), innerWidth - cardWidth - VIEWPORT_MARGIN);
    setCardPosition({ top: Math.max(top, VIEWPORT_MARGIN), left });
  }, [rect, index]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...rootRef.current.querySelectorAll("button:not(:disabled)")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className="landing-tour"
      role="dialog"
      aria-modal="true"
      aria-labelledby="landing-tour-title"
      aria-describedby="landing-tour-body"
      onKeyDown={handleKeyDown}
    >
      <div className={`landing-tour-backdrop${rect ? "" : " is-dim"}`} aria-hidden="true" />
      {rect && (
        <div
          className="landing-tour-spotlight"
          aria-hidden="true"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}
      <section
        ref={cardRef}
        className={`landing-tour-card${targetEl ? "" : " is-centered"}`}
        style={{
          ...(targetEl && cardPosition ? cardPosition : {}),
          visibility: positioned ? "visible" : "hidden",
        }}
      >
        <div className="landing-tour-top">
          <span>{t("tour.progress", { current: index + 1, total: steps.length })}</span>
          <button type="button" className="landing-tour-skip" onClick={onClose}>{t("tour.skip")}</button>
        </div>
        <h2 id="landing-tour-title" ref={headingRef} tabIndex={-1}>{step.title}</h2>
        <p id="landing-tour-body">{step.body}</p>
        {step.showInputs && (
          <div className="landing-tour-inputs" aria-hidden="true">
            <span><span className="landing-tour-input-icon is-mic">🎤</span>{t("tour.inSession.speak")}</span>
            <span><span className="landing-tour-input-icon is-type">⌨️</span>{t("tour.inSession.type")}</span>
          </div>
        )}
        <div className="landing-tour-footer">
          <div className="landing-tour-dots" aria-hidden="true">
            {steps.map((item, dotIndex) => (
              <span key={item.id} className={dotIndex === index ? "is-active" : undefined} />
            ))}
          </div>
          <div className="landing-tour-actions">
            {index > 0 && (
              <button type="button" onClick={() => setIndex((value) => value - 1)}>{t("tour.back")}</button>
            )}
            <button
              type="button"
              className="landing-tour-primary"
              onClick={() => (isLast ? onClose() : setIndex((value) => value + 1))}
            >
              {isLast ? t("tour.done") : t("tour.next")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

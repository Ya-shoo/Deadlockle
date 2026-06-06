"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { ogPreviewSrc } from "@/lib/shareLinks";
import { trackShareClicked } from "@/lib/tracking";
import type { ModeSlug } from "@/lib/modes";

// Slim share modal, link-first. One primary action — Copy link — plus a
// quiet Download of the card image.
//
// The preview is the ACTUAL /og/r/[code] image the unfurlers will
// fetch, not a client-side imitation: truthful by construction, zero
// drift risk between "what the modal shows" and "what friends see".
// (OWdle's older flow previewed a client-captured card and then copied
// a multi-mime ClipboardItem — which platforms never honored: paste
// targets pick exactly one clipboard flavor and silently drop the
// text. The link-unfurl model replaces that whole dead end.)
//
// PostHog: each action fires share_clicked with a precise method tag —
// "clipboard-link" | "download".
//
// Ported from OWdle's ShareModal — keep the two repos in lockstep.
// (The renderCard/client-capture fallback for no-OG surfaces is
// deliberately absent: every Deadlockle surface has an unfurl image.)

type Props = {
  url: string;
  ogImageUrl: string;
  filename: string;
  surface: "round_result" | "daily_complete";
  mode?: ModeSlug;
  dailyId: string;
  onClose: () => void;
};

export function ShareModal({
  url,
  ogImageUrl,
  filename,
  surface,
  mode,
  dailyId,
  onClose,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<"link" | "download" | null>(null);

  // Shared with ShareButton's result-mount prefetch — identical URL,
  // identical cache key, so the prefetched render is the one shown.
  const ogSrc = ogPreviewSrc(ogImageUrl);

  const ogStatus: "loading" | "ready" | "error" = loaded
    ? "ready"
    : failed
      ? "error"
      : "loading";

  // Lock background scroll + wire Esc-to-close. Portal target is
  // document.body — the modal must escape stacking contexts from the
  // result card's transform/opacity wrappers.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Auto-clear the confirmation chip a beat after each action so a second
  // click on the same button feels responsive (not stuck on the prior ✓).
  useEffect(() => {
    if (confirmed == null) return;
    const id = window.setTimeout(() => setConfirmed(null), 1600);
    return () => window.clearTimeout(id);
  }, [confirmed]);

  // Stall guard for the OG preview: if the image neither loads nor
  // errors within 8s (hot-reload races in dev, flaky networks in prod),
  // fall through to the "preview unavailable" copy instead of pinning
  // "Rendering preview…" forever. Copy link never depended on it.
  useEffect(() => {
    if (!ogSrc || ogStatus !== "loading") return;
    const id = window.setTimeout(() => {
      setFailed((cur) => cur || true);
    }, 8000);
    return () => window.clearTimeout(id);
  }, [ogSrc, ogStatus]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setConfirmed("link");
      trackShareClicked({ surface, method: "clipboard-link", dailyId, mode });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't copy link.",
      );
      trackShareClicked({ surface, method: "error", dailyId, mode });
    }
  }, [url, surface, mode, dailyId]);

  const handleDownload = useCallback(async () => {
    if (downloadBusy) return;
    setDownloadBusy(true);
    try {
      // Save the card image itself — exactly what the link unfurls.
      const res = await fetch(ogSrc);
      if (!res.ok) throw new Error("Couldn't fetch the card image.");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke so Safari has time to start the download before the
      // URL goes away — 1s is plenty for the click→download handoff.
      window.setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      setConfirmed("download");
      trackShareClicked({ surface, method: "download", dailyId, mode });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't fetch the image.",
      );
      trackShareClicked({ surface, method: "error", dailyId, mode });
    } finally {
      setDownloadBusy(false);
    }
  }, [downloadBusy, ogSrc, filename, surface, mode, dailyId]);

  // ShareButton is "use client" and only mounts modalOpen=true after a
  // user click, so document is always defined here. Guard kept for the
  // SSR/RSC type checker.
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your result"
      onClick={(e) => {
        // Click on the backdrop (not on bubbled child content) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000, // above absolutely everything
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[480px] max-h-[92vh] overflow-auto rounded-(--radius-card) border border-line bg-surface text-ink"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-info">
            Share your result
          </p>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 px-2 py-1 font-mono text-base leading-none text-ink-soft transition-colors hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 sm:py-6">
          {/* Preview — the exact image the link unfurls into. Fixed 1:1
              box so the modal doesn't reflow when the image lands. The
              placeholder chrome (border + inset fill) only paints while
              there's nothing to show: once the image is up the box goes
              fully transparent so transparent-cornered cards read as
              true edges. */}
          <div
            className={
              "relative mx-auto w-full max-w-sm overflow-hidden rounded-(--radius-card)" +
              (ogStatus === "ready" ? "" : " border border-line bg-inset")
            }
            style={{ aspectRatio: "1 / 1" }}
          >
            {/* Unmount the img on error — leaving it painted the
                browser's broken-image glyph behind the fallback text. */}
            {ogStatus !== "error" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ogSrc}
                alt="Share preview"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {ogStatus === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                Rendering preview…
              </div>
            )}
            {ogStatus === "error" && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Preview unavailable — the link still unfurls when pasted
              </div>
            )}
          </div>

          {/* Link readout — shows exactly what lands on the clipboard. */}
          <div className="flex items-center gap-2 rounded-(--radius-card) border border-line bg-inset/60 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-soft">
              {url}
            </code>
          </div>

          {/* THE action. Everything else is a footnote. */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-(--radius-pill) bg-info px-5 py-3.5 text-on-info shadow-lg shadow-black/30 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.22em]">
              <LinkGlyph />
              Copy link
            </span>
            <AnimatePresence>
              {confirmed === "link" && (
                <motion.span
                  key="confirmed"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center gap-2 bg-info font-mono text-[12px] uppercase tracking-[0.22em]"
                >
                  <CheckGlyph />
                  Link copied
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Quiet escape hatch for places links don't unfurl (Instagram
              stories, print-your-fridge). Saves the card image itself. */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadBusy}
            className="relative mx-auto inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-info disabled:opacity-50"
          >
            <DownloadGlyph />
            {confirmed === "download"
              ? "Saved"
              : downloadBusy
                ? "Fetching…"
                : "Download image"}
          </button>

          {actionError && (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-far">
              {actionError}
            </p>
          )}

          <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
            Paste the link anywhere — Discord, iMessage, X — and it
            unfurls into your result card.
          </p>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function LinkGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 14a3.5 3.5 0 0 1 0-5l3-3a3.5 3.5 0 1 1 5 5l-1.5 1.5M14 10a3.5 3.5 0 0 1 0 5l-3 3a3.5 3.5 0 1 1-5-5L7.5 11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v12m0 0l-4-4m4 4l4-4M4 18v2h16v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5 9-11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

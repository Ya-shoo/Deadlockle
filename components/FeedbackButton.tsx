"use client";

// Floating bottom-right feedback pill that opens a native <dialog> with a
// short (150 char) free-form textarea. Posts to /api/feedback, which lives
// on the shared owdle-votes D1 — the `source` column tags each row with
// 'deadlockle' so the inbox can be filtered per site.
//
// Why a dialog instead of inline form: keeps the pill small and avoids
// committing layout space on every page for a low-frequency action. The
// dialog is only mounted to the DOM after first open so initial paint is
// untouched.

import { useEffect, useRef, useState } from "react";

const MAX_LEN = 150;

type Status = "idle" | "sending" | "sent" | "error" | "rate_limited";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      setHasOpened(true);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    // Reset to idle on close so reopening doesn't show stale success/error.
    // Body text is preserved deliberately — if a user closes by accident
    // mid-typing, they get their draft back on reopen.
    setStatus("idle");
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LEN && status !== "sending";

  const submit = async () => {
    if (!canSend) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        setStatus("sent");
        setText("");
        // Auto-close after a short beat so the user sees the confirmation
        // without having to click away.
        setTimeout(() => {
          setOpen(false);
          setStatus("idle");
        }, 1400);
      } else if (res.status === 429) {
        setStatus("rate_limited");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter as a power-user submit shortcut. Plain Enter inserts
    // a newline so users can structure short multi-line notes naturally.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 border border-line bg-surface/95 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-colors hover:border-info hover:text-info sm:bottom-5 sm:right-5"
      >
        <SpeechMark />
        Feedback
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={onBackdropClick}
        className="m-auto w-[min(440px,92vw)] max-w-[92vw] border border-line bg-surface p-0 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-info">
            Send feedback
          </p>
          <button
            type="button"
            onClick={close}
            className="-mr-1 px-2 py-1 font-mono text-base leading-none text-ink-soft transition-colors hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {hasOpened ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm text-ink-soft">
              Bug, idea, complaint, kind word — whatever&apos;s on your mind. 150
              characters, no signup.
            </p>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={onKeyDown}
              maxLength={MAX_LEN}
              rows={4}
              disabled={status === "sending" || status === "sent"}
              placeholder="Type your feedback…"
              className="w-full resize-none border border-line bg-inset/60 p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:border-info focus:outline-none disabled:opacity-60"
            />

            <div className="flex items-center justify-between gap-3">
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                  status === "error" || status === "rate_limited"
                    ? "text-red-400"
                    : status === "sent"
                      ? "text-info"
                      : "text-ink-faint"
                }`}
              >
                {status === "sent"
                  ? "Thanks — sent"
                  : status === "rate_limited"
                    ? "Too many — try tomorrow"
                    : status === "error"
                      ? "Send failed — try again"
                      : `${trimmed.length}/${MAX_LEN}`}
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="border border-line bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink transition-colors hover:border-info hover:text-info disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
              >
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function SpeechMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 4h16v12H7l-3 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

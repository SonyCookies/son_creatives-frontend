"use client";

import type { CSSProperties } from "react";
import { useRef, useState, useEffect } from "react";
import { AdminNav } from "@/components/admin-nav";

const ADMIN_PIN = "110558";
const ADMIN_SESSION_KEY = "admin_son_creatives_unlocked";
const ADMIN_PIN_LENGTH = 6;
const maskedDigitStyle = {
  WebkitTextSecurity: "disc",
} as CSSProperties;

export function AdminAccess({ children }: { children: React.ReactNode }) {
  const [digits, setDigits] = useState<string[]>(Array(ADMIN_PIN_LENGTH).fill(""));
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const session = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
      if (session) {
        setIsUnlocked(true);
      }
      setIsReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function attemptUnlock(nextDigits: string[]) {
    if (nextDigits.some((digit) => digit === "")) {
      return;
    }

    const pin = nextDigits.join("");

    if (pin !== ADMIN_PIN) {
      setError("Incorrect PIN.");
      return;
    }

    setIsUnlocked(true);
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  }

  function updateDigit(index: number, value: string) {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    const nextDigits = digits.map((digit, digitIndex) =>
      digitIndex === index ? nextValue : digit,
    );

    setDigits(nextDigits);

    setError(null);

    if (nextValue && index < ADMIN_PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    attemptUnlock(nextDigits);
  }

  function handleBackspace(index: number, value: string) {
    if (value === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(value: string) {
    const nextDigits = value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH).split("");

    if (nextDigits.length === 0) {
      return;
    }

    const filled = Array(ADMIN_PIN_LENGTH)
      .fill("")
      .map((_, index) => nextDigits[index] ?? "");

    setDigits(filled);
    const targetIndex = Math.min(nextDigits.length, ADMIN_PIN_LENGTH) - 1;
    inputRefs.current[Math.max(targetIndex, 0)]?.focus();
    setError(null);
    attemptUnlock(filled);
  }

  function handleUnlock() {
    attemptUnlock(digits);
  }

  if (!isReady) return null;

  if (isUnlocked) {
    return (
      <div className="space-y-8">
        <div className="flex justify-center">
          <AdminNav />
        </div>
        {children}
      </div>
    );
  }

  return (
    <section className="surface-panel mx-auto flex w-full max-w-xl flex-col items-center rounded-[32px] p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
        Admin PIN
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoComplete="off"
            value={digit}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                handleBackspace(index, digit);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              handlePaste(event.clipboardData.getData("text"));
            }}
            className="h-14 w-12 rounded-2xl border border-[var(--border-soft)] bg-white text-center text-xl font-semibold outline-none focus:border-black"
            style={maskedDigitStyle}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={handleUnlock}
        className="mt-6 rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
      >
        Enter
      </button>
      {error ? (
        <p className="mt-4 text-sm font-medium text-[var(--foreground)]">{error}</p>
      ) : null}
    </section>
  );
}

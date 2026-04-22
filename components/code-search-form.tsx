"use client";

import type { FormEvent } from "react";

type CodeSearchFormProps = {
  value: string;
  isLoading: boolean;
  errorMessage: string | null;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CodeSearchForm({
  value,
  isLoading,
  errorMessage,
  onValueChange,
  onSubmit,
}: CodeSearchFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label
        htmlFor="outfit-code"
        className="block text-sm font-medium text-[var(--muted)]"
      >
        Enter the collection or outfit code
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="outfit-code"
          name="outfit-code"
          type="text"
          autoComplete="off"
          inputMode="text"
          placeholder="AAA111 or #000000"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="min-h-14 flex-1 rounded-2xl border border-[var(--border-soft)] bg-white px-4 text-base text-[var(--foreground)] outline-none placeholder:text-[rgba(0,0,0,0.42)] focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(0,0,0,0.08)]"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="min-h-14 rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-white shadow-[0_18px_34px_-18px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 hover:bg-[var(--accent-deep)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[rgba(0,0,0,0.45)]"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <p className="text-[var(--muted)]">
          Search a collection or an outfit.
        </p>
        {errorMessage ? (
          <p className="font-medium text-[var(--accent-deep)]">{errorMessage}</p>
        ) : null}
      </div>
    </form>
  );
}

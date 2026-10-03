"use client";

type SigningOutScreenProps = {
  error?: boolean;
  onRetry: () => void;
};

export function SigningOutScreen({ error = false, onRetry }: SigningOutScreenProps) {
  return (
    <div
      className="fixed inset-0 z-100 flex min-h-svh items-center justify-center bg-white px-6"
      role={error ? "alert" : "status"}
      aria-live="assertive"
    >
      <div className="flex max-w-sm flex-col items-center text-center">
        {error ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f8eeee] text-xl text-[#8b5656]" aria-hidden="true">
            !
          </span>
        ) : (
          <span
            className="h-10 w-10 animate-spin rounded-full border-4 border-[#dce8d8] border-t-[#52784f]"
            aria-hidden="true"
          />
        )}
        <h1 className="mt-5 text-lg font-semibold text-[#252724]">
          {error ? "We couldn't sign you out" : "Signing you out..."}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#72776f]">
          {error
            ? "Check your connection and try again."
            : "Please wait while we securely end your session."}
        </p>
        {error && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 rounded-lg bg-[#252724] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#41453f]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
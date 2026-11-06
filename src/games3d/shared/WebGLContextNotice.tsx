export function WebGLContextNotice({ lost }: { lost: boolean }) {
  if (!lost) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-24 z-20 mx-auto w-max max-w-[90%] rounded-full border border-coral/40 bg-night-950/90 px-4 py-2 text-center text-xs text-coral backdrop-blur-md"
    >
      3D graphics were interrupted. Restoring the renderer…
    </p>
  );
}

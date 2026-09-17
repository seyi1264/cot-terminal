export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect x="3" y="4" width="26" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 10h16M8 15h10M8 20h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M22.5 16.5c0 3.2-2.1 5.7-4.5 7 2.4-1.3 4.5-3.8 4.5-7 0-1.4-.5-2.6-1.3-3.5.9.9 1.3 2.1 1.3 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

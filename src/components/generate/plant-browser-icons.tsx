"use client";

// Shared inline SVG icons for the plant browser floating panel.
// Matches project convention — no icon library dependency.

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

export function CloseIcon({ className = "h-4 w-4", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...rest}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

export function SlidersIcon({ className = "h-3.5 w-3.5", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      {...rest}
    >
      <line x1="4" y1="7" x2="20" y2="7" strokeLinecap="round" />
      <circle cx="15" cy="7" r="2.25" fill="currentColor" stroke="none" />
      <line x1="4" y1="17" x2="20" y2="17" strokeLinecap="round" />
      <circle cx="9" cy="17" r="2.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MaximizeIcon({ className = "h-3.5 w-3.5", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...rest}
    >
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
    </svg>
  );
}

export function CheckIcon({ className = "h-3.5 w-3.5", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PlusIcon({ className = "h-3.5 w-3.5", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export function BackIcon({ className = "h-4 w-4", ...rest }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

export function GripIcon({ className = "h-3 w-3", ...rest }: IconProps) {
  // Two columns of 4 dots — subtle grabber.
  return (
    <svg className={className} viewBox="0 0 12 16" fill="currentColor" {...rest}>
      <circle cx="3" cy="3" r="1.2" />
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="3" cy="11" r="1.2" />
      <circle cx="3" cy="15" r="1.2" />
      <circle cx="9" cy="3" r="1.2" />
      <circle cx="9" cy="7" r="1.2" />
      <circle cx="9" cy="11" r="1.2" />
      <circle cx="9" cy="15" r="1.2" />
    </svg>
  );
}

export function ResizeHandleIcon({ className = "h-3 w-3", ...rest }: IconProps) {
  // 3 diagonal ticks in the bottom-right, classic window resize affordance.
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      {...rest}
    >
      <line x1="11" y1="3" x2="3" y2="11" />
      <line x1="11" y1="6" x2="6" y2="11" />
      <line x1="11" y1="9" x2="9" y2="11" />
    </svg>
  );
}

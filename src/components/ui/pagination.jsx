import * as React from "react";

const Pagination = ({ className = "", ...props }) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={`mx-auto flex w-full justify-center ${className}`}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef(({ className = "", ...props }, ref) => (
  <ul
    ref={ref}
    className={`flex flex-row items-center gap-1 ${className}`}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef(({ className = "", ...props }, ref) => (
  <li ref={ref} className={`inline-flex ${className}`} {...props} />
));
PaginationItem.displayName = "PaginationItem";

const PaginationLink = ({
  className = "",
  isActive = false,
  size = "icon",
  ...props
}) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${
      isActive
        ? "bg-neutral-900 text-neutral-50 shadow hover:bg-neutral-900/90 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-50/90"
        : "border border-transparent hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
    } h-8 min-w-[32px] px-2.5 text-xs ${className}`}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className = "",
  ...props
}) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={`gap-1 pl-2.5 pr-3 rounded-full border border-neutral-200 dark:border-neutral-800 ${className}`}
    {...props}
  >
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span>Anterior</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
  className = "",
  ...props
}) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={`gap-1 pl-3 pr-2.5 rounded-full border border-neutral-200 dark:border-neutral-800 ${className}`}
    {...props}
  >
    <span>Siguiente</span>
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
      <path d="M7.5 15l5-5-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({
  className = "",
  ...props
}) => (
  <span
    aria-hidden
    className={`flex h-8 w-8 items-center justify-center text-neutral-400 ${className}`}
    {...props}
  >
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="4" cy="10" r="1.5"/>
      <circle cx="10" cy="10" r="1.5"/>
      <circle cx="16" cy="10" r="1.5"/>
    </svg>
    <span className="sr-only">Más páginas</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};

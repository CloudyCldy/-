// Compact pagination component using shadcn UI primitives
// Provides a more compact and visible pagination bar with previous/next arrows and ellipsis.
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./ui/pagination";
export { PaginationSimple } from "./PaginationSimple";

/**
 * Props
 * @param {number} totalPages - total number of pages
 * @param {number} currentPage - currently active page (1‑based)
 * @param {(page:number)=>void} onPageChange - callback when a page is selected
 */
export default function CompactPagination({ totalPages, currentPage, onPageChange }) {
  const generatePages = () => {
    const pages = [];
    // always show first, last, current, and neighbours
    const delta = 1; // how many neighbours on each side
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      } else if (
        i === currentPage - delta - 1 ||
        i === currentPage + delta + 1
      ) {
        range.push('ellipsis');
      }
    }
    // collapse consecutive ellipsis
    let prev = null;
    for (const p of range) {
      if (p === 'ellipsis' && prev === 'ellipsis') continue;
      pages.push(p);
      prev = p;
    }
    return pages;
  };

  const pages = generatePages();

  const handleClick = (page) => {
    if (page !== currentPage && typeof onPageChange === 'function') {
      onPageChange(page);
    }
  };

  return (
    <Pagination className="flex justify-center">
      <PaginationContent className="flex space-x-0.5">
        {/* Previous button */}
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) handleClick(currentPage - 1);
            }}
            className="h-7 w-7 px-1 text-xs"
          />
        </PaginationItem>
        {pages.map((p, idx) => (
          <PaginationItem key={idx}>
            {p === 'ellipsis' ? (
              <PaginationEllipsis className="h-7 w-7" />
            ) : (
              <PaginationLink
                href="#"
                isActive={p === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick(p);
                }}
                className="h-7 w-7 px-1 text-xs"
              >
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        {/* Next button */}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) handleClick(currentPage + 1);
            }}
            className="h-7 w-7 px-1 text-xs"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

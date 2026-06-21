const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

function TablePagination({
  currentPage,
  totalPages,
  rowsPerPage,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onRowsPerPageChange,
}) {
  const firstVisibleItem = totalItems === 0 ? 0 : startIndex + 1;
  const lastVisibleItem = Math.min(endIndex, totalItems);

  return (
    <div className="table-pagination" aria-label="Table pagination">
      <p className="table-pagination__info" aria-live="polite">
        Showing <strong>{firstVisibleItem}</strong> to{" "}
        <strong>{lastVisibleItem}</strong> of <strong>{totalItems}</strong>
      </p>

      <label className="table-pagination__size">
        <span>Rows</span>
        <select
          value={rowsPerPage}
          onChange={(event) =>
            onRowsPerPageChange(Number(event.target.value))
          }
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </label>

      <span className="table-pagination__status">
        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
      </span>

      <div className="table-pagination__nav">
        <button
          type="button"
          className="table-pagination__first"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          First
        </button>
        <button
          type="button"
          className="table-pagination__previous"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <button
          type="button"
          className="table-pagination__next"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
        <button
          type="button"
          className="table-pagination__last"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          Last
        </button>
      </div>
    </div>
  );
}

export default TablePagination;

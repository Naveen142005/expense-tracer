const reportMenuItems = [
  { label: "Full History", value: "history" },
  { label: "Type-wise", value: "type" },
  { label: "Payment-wise", value: "payment" },
  { label: "Period-wise", value: "period" },
  { label: "Date-wise", value: "date" },
  { label: "Month-wise", value: "month" },
  { label: "Item-wise", value: "item" },
  { label: "Balance History", value: "balance" },
  { label: "Export / Backup", value: "export" },
];

function ChevronIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={open ? "M6 15L12 9L18 15" : "M6 9L12 15L18 9"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportSidebar({ activeReport, onChange, isOpen, onToggle }) {
  return (
    <aside
      className={
        isOpen
          ? "report-sidebar card"
          : "report-sidebar card report-sidebar--closed"
      }
    >
      <div className="report-sidebar__header">
        <div>
          <span className="report-sidebar__eyebrow">Explore</span>
          <h3>Report Views</h3>
        </div>

        <button
          type="button"
          className="report-sidebar__toggle"
          onClick={onToggle}
          title={isOpen ? "Hide report menu" : "Show report menu"}
        >
          <ChevronIcon open={isOpen} />
        </button>
      </div>

      <div className="report-sidebar__list">
        {reportMenuItems.map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              activeReport === item.value
                ? "report-sidebar__btn report-sidebar__btn--active"
                : "report-sidebar__btn"
            }
            onClick={() => onChange(item.value)}
            aria-current={activeReport === item.value ? "page" : undefined}
          >
            <span className="report-sidebar__btn-marker" aria-hidden="true" />
            <span className="report-sidebar__btn-label">{item.label}</span>
            <span className="report-sidebar__btn-arrow" aria-hidden="true" />
          </button>
        ))}
      </div>
    </aside>
  );
}

export default ReportSidebar;

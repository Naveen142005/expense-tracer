const reportMenuItems = [
  {
    label: "Analytics",
    mobileLabel: "Analytics",
    value: "analytics",
    description: "Explore summaries, trends, and charts",
  },
  {
    label: "Full History",
    mobileLabel: "History",
    value: "history",
    description: "Search and review every expense",
  },
  {
    label: "Balance History",
    mobileLabel: "Balance",
    value: "balance",
    description: "Review cash and GPay activity",
  },
  {
    label: "Export & Backup",
    mobileLabel: "Export",
    value: "export",
    description: "Download a copy of your records",
  },
];

function ReportViewIcon({ type }) {
  if (type === "analytics") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19V11M12 19V5M19 19V14" />
      </svg>
    );
  }

  if (type === "balance") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7.5H18.5A1.5 1.5 0 0 1 20 9v9H5.5A1.5 1.5 0 0 1 4 16.5v-9Z" />
        <path d="M4 8V6a2 2 0 0 1 2-2h11" />
        <path d="M15.5 13h2" />
      </svg>
    );
  }

  if (type === "export") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4v10M8 10l4 4 4-4" />
        <path d="M5 17v2h14v-2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function ReportViewButtons({ activeReport, onChange }) {
  return reportMenuItems.map((item) => {
    const active = activeReport === item.value;

    return (
      <button
        key={item.value}
        type="button"
        className={`report-view-option${
          active ? " report-view-option--active" : ""
        }`}
        onClick={() => onChange(item.value)}
        aria-current={active ? "page" : undefined}
      >
        <span className="report-view-option__icon">
          <ReportViewIcon type={item.value} />
        </span>
        <span className="report-view-option__copy">
          <strong className="report-view-option__desktop-label">
            {item.label}
          </strong>
          <strong className="report-view-option__mobile-label">
            {item.mobileLabel}
          </strong>
          <small>{item.description}</small>
        </span>
        <span className="report-view-option__indicator" aria-hidden="true">
          {active ? "✓" : "›"}
        </span>
      </button>
    );
  });
}

function ReportSidebar({ activeReport, onChange }) {
  return (
    <section className="report-view-switcher" aria-label="Report views">
      <div className="report-view-switcher__heading">
        <div>
          <span>Report views</span>
          <h3>Choose your workspace</h3>
        </div>
        <p>Everything stays full-width and focused.</p>
      </div>
      <nav className="report-view-switcher__options">
        <ReportViewButtons activeReport={activeReport} onChange={onChange} />
      </nav>
    </section>
  );
}

export default ReportSidebar;

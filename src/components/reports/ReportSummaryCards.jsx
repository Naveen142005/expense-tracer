import { formatCurrency } from "../../utils/totalUtils";

function ReportSummaryCards({
  lifetimeTotal = 0,
  lifetimeCashTotal = 0,
  lifetimeGPayTotal = 0,
  todayTotal = 0,
  monthTotal = 0,
  yearTotal = 0,
  mostSpentDay,
  mostUsedItem,
}) {
  return (
    <div className="report-summary-grid">
      <div className="card report-card">
        <p>Lifetime Total Spend</p>
        <h3>{formatCurrency(lifetimeTotal)}</h3>
      </div>

      <div className="card report-card">
        <p>Lifetime Cash Spend</p>
        <h3>{formatCurrency(lifetimeCashTotal)}</h3>
      </div>

      <div className="card report-card">
        <p>Lifetime GPay Spend</p>
        <h3>{formatCurrency(lifetimeGPayTotal)}</h3>
      </div>

      <div className="card report-card">
        <p>Today Spend</p>
        <h3>{formatCurrency(todayTotal)}</h3>
      </div>

      <div className="card report-card">
        <p>This Month Spend</p>
        <h3>{formatCurrency(monthTotal)}</h3>
      </div>

      <div className="card report-card">
        <p>This Year Spend</p>
        <h3>{formatCurrency(yearTotal)}</h3>
      </div>

      <div className="card report-card">
        <p>Most Spent Day</p>
        <h3>{mostSpentDay?.date || "-"}</h3>
        <small>{formatCurrency(mostSpentDay?.total || 0)}</small>
      </div>

      <div className="card report-card">
        <p>Most Used Item</p>
        <h3>
          {mostUsedItem?.name
            ? mostUsedItem.name.charAt(0).toUpperCase() +
              mostUsedItem.name.slice(1)
            : "-"}
        </h3>
        <small>{mostUsedItem?.count || 0} times</small>
      </div>
    </div>
  );
}

export default ReportSummaryCards;

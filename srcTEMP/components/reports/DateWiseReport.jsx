import EmptyState from "../common/EmptyState";
import { formatDisplayDate } from "../../utils/dateUtils";
import { formatCurrency } from "../../utils/totalUtils";

function DateWiseReport({ data = {}, title = "Date-wise Total" }) {
  const rows = Object.entries(data).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="card report-table-card">
      <h3>{title}</h3>

      {rows.length === 0 ? (
        <EmptyState title="No date report" message="No data available." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(([date, total]) => (
                <tr key={date}>
                  <td>{date.length === 10 ? formatDisplayDate(date) : date}</td>
                  <td>{formatCurrency(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DateWiseReport;
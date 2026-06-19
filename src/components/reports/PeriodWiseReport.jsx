import EmptyState from "../common/EmptyState";
import { formatCurrency } from "../../utils/totalUtils";

function PeriodWiseReport({ data = {} }) {
  const rows = Object.entries(data);

  return (
    <div className="card report-table-card">
      <h3>Period-wise Total</h3>

      {rows.length === 0 ? (
        <EmptyState title="No period report" message="No data available." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(([period, total]) => (
                <tr key={period}>
                  <td>{period}</td>
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

export default PeriodWiseReport;
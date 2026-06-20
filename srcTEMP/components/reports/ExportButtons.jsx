import Button from "../common/Button";
import { exportAsCSV, exportAsJSON } from "../../utils/exportUtils";

function ExportButtons({ expenses = [], balanceHistory = [] }) {
  function handleJSONExport() {
    exportAsJSON(
      {
        expenses,
        balanceHistory,
        exportedAt: new Date().toISOString(),
      },
      "expense-tracker-backup.json"
    );
  }

  function handleCSVExport() {
    exportAsCSV(expenses, "expense-history.csv");
  }

  return (
    <div className="card export-card">
      <h3>Backup / Export</h3>
      <p className="muted-text">
        Download your data regularly for long-term safety.
      </p>

      <div className="export-actions">
        <Button onClick={handleJSONExport}>Export JSON Backup</Button>
        <Button variant="secondary" onClick={handleCSVExport}>
          Export CSV
        </Button>
      </div>
    </div>
  );
}

export default ExportButtons;
import { EXPENSE_TYPES, PAYMENT_TYPES, PERIODS } from "../../utils/constants";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

function ReportFilters({ filters, onChange, onReset }) {
  function handleChange(event) {
    const { name, value } = event.target;
    onChange(name, value);
  }

  return (
    <div className="card report-filters">
      <div className="card-header">
        <h3>Report Filters</h3>
        <Button variant="secondary" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>

      <div className="form-grid report-filter-grid">
        <Input
          label="Start Date"
          name="startDate"
          type="date"
          value={filters.startDate}
          onChange={handleChange}
        />

        <Input
          label="End Date"
          name="endDate"
          type="date"
          value={filters.endDate}
          onChange={handleChange}
        />

        <Select
          label="Type"
          name="type"
          value={filters.type}
          onChange={handleChange}
          options={[
            { label: "All Types", value: "all" },
            ...EXPENSE_TYPES,
          ]}
        />

        <Select
          label="Payment"
          name="paymentType"
          value={filters.paymentType}
          onChange={handleChange}
          options={[
            { label: "All Payments", value: "all" },
            ...PAYMENT_TYPES,
          ]}
        />

        <Select
          label="Period"
          name="period"
          value={filters.period}
          onChange={handleChange}
          options={[
            { label: "All Periods", value: "all" },
            ...PERIODS,
          ]}
        />

        <Input
          label="Search"
          name="search"
          value={filters.search}
          onChange={handleChange}
          placeholder="Search item or description"
        />
      </div>
    </div>
  );
}

export default ReportFilters;
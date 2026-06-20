import { PERIODS } from "../../utils/constants";

function PeriodTabs({ activePeriod, onChange, disabled = false }) {
  return (
    <div className="period-tabs">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          className={
            activePeriod === period.value
              ? "period-tab period-tab--active"
              : "period-tab"
          }
          onClick={() => onChange(period.value)}
          disabled={disabled}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

export default PeriodTabs;

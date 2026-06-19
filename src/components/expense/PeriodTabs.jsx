import { PERIODS } from "../../utils/constants";

function PeriodTabs({ activePeriod, onChange }) {
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
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

export default PeriodTabs;
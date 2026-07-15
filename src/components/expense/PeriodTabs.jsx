import { PERIODS } from "../../utils/constants";
import AppIcon from "../common/AppIcon";

const periodIcons = {
  morning: "sunrise",
  afternoon: "sun",
  evening: "sunset",
  night: "moon",
  other: "clock",
  all: "calendar",
};

function PeriodTabs({ activePeriod, onChange, disabled = false, includeAll = false }) {
  const periodOptions = includeAll
    ? [{ label: "All Periods", value: "all" }, ...PERIODS]
    : PERIODS;

  return (
    <div className="period-tabs">
      {periodOptions.map((period) => (
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
          <AppIcon name={periodIcons[period.value] || "clock"} size={17} />
          <span>{period.label}</span>
        </button>
      ))}
    </div>
  );
}

export default PeriodTabs;

export function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function formatCurrency(value) {
  return `₹${toNumber(value).toFixed(2)}`;
}

export function calculateTotal(items = []) {
  return items.reduce((total, item) => total + toNumber(item.price), 0);
}

export function calculateCashTotal(items = []) {
  return items
    .filter((item) => item.paymentType === "cash")
    .reduce((total, item) => total + toNumber(item.price), 0);
}

export function calculateGPayTotal(items = []) {
  return items
    .filter((item) => item.paymentType === "gpay")
    .reduce((total, item) => total + toNumber(item.price), 0);
}

export function calculateTransactionSummary(items = []) {
  const total = calculateTotal(items);
  const cashTotal = calculateCashTotal(items);
  const gpayTotal = calculateGPayTotal(items);

  return {
    total,
    cashTotal,
    gpayTotal,
  };
}

export function groupTotalByKey(items = [], key) {
  return items.reduce((result, item) => {
    const groupName = item[key] || "unknown";
    result[groupName] = (result[groupName] || 0) + toNumber(item.price);
    return result;
  }, {});
}

export function getMostSpentDay(items = []) {
  const dateTotals = groupTotalByKey(items, "date");

  let maxDate = "";
  let maxTotal = 0;

  Object.entries(dateTotals).forEach(([date, total]) => {
    if (total > maxTotal) {
      maxDate = date;
      maxTotal = total;
    }
  });

  return {
    date: maxDate,
    total: maxTotal,
  };
}

export function getMostUsedItem(items = []) {
  const countMap = items.reduce((result, item) => {
    const name = item.name || item.description || "unknown";
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});

  let itemName = "";
  let count = 0;

  Object.entries(countMap).forEach(([name, itemCount]) => {
    if (itemCount > count) {
      itemName = name;
      count = itemCount;
    }
  });

  return {
    name: itemName,
    count,
  };
}
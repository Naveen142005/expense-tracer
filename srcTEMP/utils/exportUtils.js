function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "";

  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }

  return "";
}

export function exportAsJSON(data, filename = "expense-data.json") {
  const jsonContent = JSON.stringify(data, null, 2);

  downloadFile(filename, jsonContent, "application/json");
}

export function exportAsCSV(items = [], filename = "expense-data.csv") {
  const headers = [
    "Date",
    "Period",
    "Type",
    "Name",
    "Description",
    "Payment Type",
    "Price",
    "Created At",
  ];

  const rows = items.map((item) => [
    item.date || "",
    item.period || "",
    item.type || "",
    item.name || "",
    item.description || "",
    item.paymentType || "",
    item.price || 0,
    formatTimestamp(item.createdAt),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  downloadFile(filename, csvContent, "text/csv");
}
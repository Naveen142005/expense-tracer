function EmptyState({
  title = "No data found",
  message = "There is nothing to show here.",
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default EmptyState;
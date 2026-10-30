const DEFAULT_MOCKAPI_URL =
  "https://6a718e7ef687776c13f05fa9.mockapi.io/api/v1/trips";

let tripsCache = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export function getTravelTrackerUrl() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("travel_tracker_url");
    if (saved) return saved;
  }
  return (
    import.meta.env.VITE_TRAVEL_TRACKER_URL ||
    "https://travel-tracker-mauve.vercel.app/"
  );
}

export function setTravelTrackerUrl(url) {
  if (typeof window !== "undefined") {
    localStorage.setItem("travel_tracker_url", url);
  }
}

/**
 * Fetch all trips from Travel Tracker MockAPI
 */
export async function fetchTravelTrips({ force = false } = {}) {
  const now = Date.now();
  if (!force && tripsCache && now - lastFetchedAt < CACHE_TTL_MS) {
    return tripsCache;
  }

  try {
    const res = await fetch(DEFAULT_MOCKAPI_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch trips (${res.status})`);
    }
    const trips = await res.json();
    tripsCache = Array.isArray(trips) ? trips : [];
    lastFetchedAt = now;
    return tripsCache;
  } catch (error) {
    console.error("Travel Tracker integration fetch error:", error);
    if (tripsCache) return tripsCache;
    throw error;
  }
}

/**
 * Transform a trip from Travel Tracker to a normalized expense item
 */
export function transformTripToExpense(trip) {
  const from = trip.from || (trip.legs && trip.legs[0]?.from) || "Origin";
  const to =
    trip.to ||
    (trip.legs && trip.legs[trip.legs.length - 1]?.to) ||
    "Destination";
  const rawMode = (trip.mode || "Travel").trim();
  const cleanMode = rawMode.charAt(0).toUpperCase() + rawMode.slice(1);
  const typeKey = cleanMode.toLowerCase();
  const cost = Number(trip.cost || 0);
  const date = trip.date || trip.tripDate || new Date().toISOString().slice(0, 10);

  return {
    id: `travel_${trip.id}`,
    originalTripId: trip.id,
    name: `Trip: ${from} → ${to}`,
    nameText: `Trip: ${from} → ${to}`,
    date,
    price: cost,
    type: typeKey,
    displayType: cleanMode === "Mixed" ? "Mixed (Multi-leg)" : cleanMode,
    travelMode: cleanMode,
    paymentType: "gpay",
    period: "other",
    description: trip.notes
      ? `[${cleanMode}] ${trip.notes}`
      : `[${cleanMode}] Status: ${trip.status || "Completed"}`,
    isTravelLog: true,
    source: "travel_tracker",
    travelDetails: {
      from,
      to,
      mode: cleanMode,
      displayType: cleanMode === "Mixed" ? "Mixed (Multi-leg)" : cleanMode,
      status: trip.status || "Completed",
      legs: trip.legs || [],
      favorite: Boolean(trip.favorite),
      notes: trip.notes || "",
    },
  };
}

/**
 * Get normalized travel expenses only, sorted descending by date
 */
export function getTravelExpensesOnly(trips = []) {
  return trips.map(transformTripToExpense).sort((a, b) => {
    if (a.date !== b.date) {
      return (b.date || "").localeCompare(a.date || "");
    }
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

/**
 * Merge regular Firestore expenses with travel trips
 */
export function mergeExpensesWithTravel(expenses = [], trips = []) {
  const travelExpenses = trips.map(transformTripToExpense);
  const combined = [...expenses, ...travelExpenses];

  // Sort descending by date, then by id
  return combined.sort((a, b) => {
    if (a.date !== b.date) {
      return (b.date || "").localeCompare(a.date || "");
    }
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

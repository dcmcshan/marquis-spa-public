window.MarquisBookingConfig = {
  bookingEndpoint: "https://marquis-booking-bridge.marquis-spa.workers.dev",
  location: "Marquis day SPA",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  successMessage: "Your preferred time was recorded as a booking request. Please wait for personal confirmation before treating it as booked.",
};

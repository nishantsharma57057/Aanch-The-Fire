See HOSTINGER-SETUP.md. Open /#/admin/login on your domain, sign in using generated credentials, enroll your authenticator and verify the current OTP. Set and confirm the restaurant pin in Delivery settings before accepting delivery orders. Customer records are visible in My bookings / My orders in the same browser session.

## Live restaurant alerts

After password + authenticator verification, a **Restaurant alerts** bell is available on every page, including Home. It checks for table bookings, linked food pre-orders, delivery and pickup requests every 5 seconds while the site is running. Requests are not automatically accepted.

- Click **Enable sound** once after opening/reloading the site. You will hear a short sample chime. Keep device volume on. The control becomes available again if the browser suspends audio.
- Open the bell for unread requests, **Mark all read**, sound controls and optional **Enable desktop alerts**. Desktop permission is requested only when you click it. Mobile browsers may not support desktop alerts.
- **View request** opens the appropriate admin screen filtered to its reference. Clear the booking search or use **Show all requests** to return to the full list.
- The first login silently loads pending requests created in the previous 24 hours. Later arrivals trigger popups; missed popups remain in the list. Up to 100 recent alert summaries/read states are saved in this browser, separate from the full database records. Other tabs on the same origin share read state and deduplicate audible chimes when Web Locks is supported.
- The panel shows offline/reconnecting status and retries automatically. Session expiry pauses alerts and shows a sign-in link. Customers never receive the admin feed.

Admin sessions now have an absolute 12-hour lifetime by default. Set `ADMIN_SESSION_HOURS` in Hostinger environment variables to a value from `0.5` to `24` if needed, then restart. Existing sessions retain their old expiry; sign out and sign in again after deployment to receive the new lifetime. Always sign out on shared devices.

These are in-site alerts, with optional desktop notifications while the site is running. Closing the browser, device sleep, lost connectivity, muted audio, Do Not Disturb or browser background throttling can delay/prevent alerts. This does not implement push notifications to a closed browser, SMS, email or WhatsApp.

## Deploying this update

Use the updated source in Hostinger's connected deployment branch, run `npm ci` and `npm run build`, then restart with `npm start` (or use Hostinger's redeploy action). No new database tables, credentials, external notification service or API keys are required. Test with a separate customer browser after enabling sound in the admin browser.

# Aanch The Fire — design audit & implementation

Date: 31 October 2026 (India)

## Scope and preserved behavior

Audited the supplied React/Vite project: all five JSX screens/modules, catalog/options, seven presentation stylesheets, self-hosted fonts, map/location code, Worker API, SQLite adapter, schema/migrations, build scripts and existing tests. The supplied source matches the hosted repository for application code; the archive includes additional setup documentation, which is retained.

Routes retained: `/`, `/menu`, `/order`, `/orders`, `/orders/:id`, `/book`, `/cart`, `/checkout`, `/bookings`, `/confirmation/:id`, `/celebrations`, `/story`, `/contact`, `/offers`, `/guide/:slug`, `/manage`, `/manage-orders`, `/delivery-settings`. Routes still use the existing hash router.

Server API, catalog prices/options, database schema and migrations were not changed. Session isolation, owner checks, cart storage, request keys, server pricing, cancellation and fulfilment transitions remain in place. No external messages or payments were sent during QA. Test records and restaurant coordinates were created only in the ignored local SQLite database, which is excluded from delivery.

## Main findings

| Existing issue | Implemented response |
| --- | --- |
| Seven overlapping stylesheet generations; repeated global selectors and conflicting breakpoints | One active presentation system in `design.css`; vendor map styles load separately when needed. Older source styles are retained but inactive. |
| Generic arch photo, floating seal, decorative caption card and repetitive three-column sections | Rectangular photographic cover; editorial type; numbered dining paths; asymmetric cuisine index; functional planner; contrasting celebration spread; meal list and compact location close. |
| Very small, low-contrast interface text, labels and notes across ordering/reservations | Deliberate heading/body/label scales; darker body copy; larger fields, prices and quantity controls; mobile field type at 16px. |
| Branding reduced to ubiquitous black/gold restaurant styling | Warm paper, charcoal and a chilli-red accent connected to the supplied fire identity; gold reserved for supporting detail in dark sections. |
| Unrelated food photos reused for exact dishes, including samosas for Chinese items | Suitable cuisine photos are explicitly illustrative. Other categories use a quiet utensil marker and category text rather than an inaccurate photograph. |
| Competing conversion choices without a consistent hierarchy | Order online and reserve a table lead; menu discovery, pickup, celebrations and visit information support them. No invented reviews, awards, opening hours or delivery times. |
| Map code/styles included on pages that do not use them | Delivery settings and map UI are loaded lazily with visible loading messages. |
| WebGL renderer failure left a partially registered Leaflet adapter and could crash checkout | Probe WebGL2 before adding the layer; detach failed layer listeners safely. Manual pin/coordinate workflow remains usable without vector rendering. |
| Worker build imports esbuild without declaring it | Added an explicit pinned development dependency matching the build environment. |

## Creative direction

Contemporary Indian dining journal: strong typography, restrained colour, relevant food photography and editorial hierarchy. Display type is self-hosted Cormorant Garamond, with Manrope for reading and controls. Display italics are used sparingly; form labels, prices and navigation remain sans serif.

The layout uses a shared page gutter, fine rules, practical spacing and varied compositions. The primary CTA is chilli red; secondary navigation uses text underlines or outlined buttons. Commerce panels are intentionally quiet. Dropdowns remain native for reliable keyboard and mobile operation. Focus rings, a skip link, route focus, pressed category states, polite result announcements, Escape-to-close mobile navigation and reduced-motion handling are included. Animation is limited to control feedback and small image hovers.

## Screen changes

- Home: new art direction and content structure; supplied date/guest shortcut still passes values into the booking form.
- Menu: category rail on desktop and horizontal scrolling on mobile; readable item rows; prices and Add/quantity share a row, options sit above.
- Online order: compact food-led cover, segmented delivery/pickup selector, search/sort/category tools, horizontal dish rows and sticky desktop basket. Mobile basket shortcut stays above bottom navigation.
- Booking/checkout: clearer progress, form groupings, readable consent and bill notes; visit summary and payment-at-restaurant expectations remain explicit.
- History/confirmation: consistent status chips, references, order steps, cancellation and details styling; print controls preserved.
- Celebrations/story/contact/offers/guides: editorial compositions, fewer ornamental surfaces, readable FAQs, contact links and menu-price lists.
- Management/settings: shared controls, summary metrics, filters and record styles; existing authorisation remains enforced on the server.

## Verification

- Existing automated suite: 13 tests pass. Covers reservation/pre-order persistence, server prices, duplicate-submit protection, variants, quantities, invalid input, session isolation, owner-only APIs, cancellation, delivery/pickup status lifecycles, server-enforced 5 km radius and geolocation success/retry/denial/abort/manual fallback behavior.
- Production frontend + Worker build succeeds with the declared esbuild dependency. MapLibre remains a large on-demand vendor chunk; it is not part of the initial homepage bundle.
- Browser: mobile menu opens and reserve action navigates; a real local table request was saved, then food quantities were selected, pre-order submitted and booking/reference confirmation rendered.
- Browser: pickup request submitted with a selected gravy variant; saved order/status rendered. Reorder navigation was exercised.
- Browser: delivery coordinates accepted, 1.11 km eligibility rendered, request persisted with its destination/distance, cancellation confirmation shown, and cancellation persisted.
- Responsive DOM checks: core public screens at 360, 768, 1024 and 1440px iframe widths; history/empty/editorial/protected-entry screens at 390, 768 and 1024px. No page-level horizontal overflow or broken loaded images in those checks. Screenshots reviewed for desktop/mobile home, mobile menu, ordering and confirmation. These are sampled checks, not a device-lab certification.
- Protected management API behavior tested by the automated suite; unauthorised entry screens checked in browser. Privileged live-owner workflows were not executed against production data.

## Remaining limitations

- No genuine venue photography or exact-dish photo catalog was supplied. Existing illustrative imagery is labelled; authentic restaurant photography is the most valuable future content improvement.
- The QA browser has no WebGL2. The Bright vector map's successful tile rendering and drag interactions could not be visually verified here. Its safe failure state and manual-coordinate eligibility flow were verified. Native GPS permission/device accuracy also needs a real device check; its helper behavior is covered by tests.
- Delivery needs the owner's real restaurant entrance configured in production. Test coordinates were not deployed. Coverage remains a straight-line 5 km radius, not road distance.
- Original business limitations remain: request-based confirmation, no payment gateway, no courier/GPS integration and no automated notifications. Final availability, timing, taxes and charges are confirmed by the restaurant.
- SEO metadata improved, but this remains a client-rendered hash-routed app. Independent indexable route HTML/server rendering is a separate architectural project; no ranking claims are made.

## Follow-up: curved styling and visible administration

At the user's request, the previous curved image hero, circular seal, caption, softer button/panel shapes and dark header were restored. The supplied brand artwork and optimised image derivatives remain in use.

A visible Admin entry and unified workspace now bring together Overview, Tables & pre-orders, Delivery & pickup, and Delivery area. The owner login panel uses the existing secure hosting sign-in, includes access retry/switch-account states, and never grants admin rights from client state. Server session metadata now indicates signed-in state and exposes the current email only to an authorised owner. Legacy management routes remain supported. Dashboard metrics are clearly scoped to the existing recent-record limit.

Follow-up verification: 14 automated tests pass. An isolated local QA copy was used to verify dashboard data from separate customer records; booking search; item/quantity/instruction visibility; confirming a table and attached food pre-order; and accepting an online pickup order. Production API authorisation was not weakened and local test identity/data are not included in the delivery. Responsive checks cover 360, 390, 768 and 1024px widths; a narrow-screen navigation overflow discovered during QA was corrected. Native production owner sign-in requires the real authorised account.

## Follow-up: reachable order history, field fixes and OTP

Added a permanent My Orders link to desktop, mobile and footer navigation so customers can return to order status from the homepage. Table history remains under My Bookings. Fixed Safari/native select sizing, set history controls to 50px, and prevented Order food / All orders labels from breaking. Moved desktop dish-option selectors beside dish names; kept full-width option fields on narrow screens. Changed primary accents to muted fire orange while preserving sufficient text contrast.

Admin entry links now always open the login panel. An additional TOTP authenticator factor is enforced on the server after native owner sign-in. Enrollment uses a locally generated QR, AES-GCM encrypted secrets bound to the owner, hashed 30-minute HttpOnly session cookies, code replay prevention and persistent verification attempt limits. The encryption key is a server runtime secret, excluded from source and exported files. Additive MFA/session tables preserve the restaurant data.

Verification: 18 automated tests pass, including RFC 6238 vectors, enrollment and access enforcement, invalid/replayed codes, attempt limiting, expiry, logout, identity binding, missing-key failure and cross-origin rejection. Browser checks verified the protected OTP/setup UI and QR/form presence, homepage-to-history navigation, single-line toolbar labels, 50px filter height, desktop gravy placement and selected-variant cart behavior. The OTP API flow is exercised by integration tests; live owner enrollment is left for the real owner. Twenty-five responsive page checks across 360, 390, 650, 768 and 1024px found no page-level overflow.

# Obituary UI Automation

This is a standalone Playwright project for testing the public obituary form and publisher review flow. It is intentionally separate from the frontend, dashboard, and backend test suites.

## Requirements

- Node.js 20+
- The local MariaDB, backend, public frontend, and publisher dashboard running
- A local admin/editor account for dashboard review checks

By default, the test targets `http://localhost:3000`, `http://localhost:3001`, and `http://localhost:4000/api`. Browser API requests are routed to this local backend, including builds that were compiled with a non-local API URL; the test does not send API requests to external hosts.

## Setup

```powershell
cd ui-automation
npm install
npx playwright install chromium
Copy-Item .env.example .env
```

Set `OBITUARY_ADMIN_EMAIL` and `OBITUARY_ADMIN_PASSWORD` in `.env` to a local admin account. Credentials are read only at runtime and must not be committed.
Alternatively, set `OBITUARY_STORAGE_STATE` to an authenticated Playwright storage-state JSON file for the local dashboard.
Set `OBITUARY_USER_EMAIL`, `OBITUARY_USER_PASSWORD`, and `OBITUARY_USER_NAME` to an existing local public-site account to run the signed-in submission test. Alternatively, set `OBITUARY_REGISTER_TEST_USER=true` to register a clearly labelled, unique test account through the UI, verify its email, log out, sign in through the UI, and submit a test obituary. Configure Gmail SMTP in the repository-root `.env` first. The headed test pauses at the OTP step so you can enter the code from the test inbox in the browser, then resume Playwright. This leaves test accounts and records in the local database. The test checks dashboard attribution when admin credentials are also available.

The `email registration requires a verification code before signing in` UI test uses mocked auth responses to verify the visible OTP step and client behavior. Backend auth tests separately cover OTP delivery requests, expiry, invalid codes, account creation after verification, and Google token verification. A real mailbox delivery test requires configured SMTP credentials and manual OTP entry (or a dedicated test mailbox integration).

## Run

```powershell
npm test
```

The default command launches a visible Chromium browser, opens the configured local public site, and runs tests one at a time in file order. Browser actions are slowed by 500 ms so the steps are easier to follow. Keep the browser window open while the run is in progress. To run without displaying a browser, use `npx playwright test`.

A public-form smoke test can run without dashboard credentials. It fills every detail field through the visible form, verifies each entered value, uploads a generated PNG and checks that its preview loads, then submits and verifies the visible success confirmation. It asserts the user-facing result rather than relying on a direct API call or response-body check.

When a public user signs in, login and registration use same-origin frontend routes, and obituary submissions forward the user's verified access token to the backend. The backend derives the submitter name and email from that token rather than trusting browser-supplied identity fields. Anonymous submissions are stored and shown as `Anonymous`.

The form caps the date of death at the user's local current date and rejects future dates with an inline validation message. Date of birth is capped at yesterday, so it must be before today; focused browser tests cover both rules.

The authenticated public-submission review test additionally checks the pending status, submitted values, and image preview in the dashboard. By default, it cancels the editorial form so the submission remains pending and is not published.

A second browser workflow submits a fictional obituary through the public form, reviews it in the dashboard, uploads a generated image in the editorial approval form, approves it, and navigates to the published result from the public obituary listing. It verifies the publication content, personal details, and rendered image, then deletes only the unique test record through the dashboard UI. Both tests drive state changes and assert results through the visible UI; API traffic is routed to the configured local backend, but tests do not inspect response bodies or call mutation endpoints directly.

To additionally exercise approval and public visibility:

```powershell
$env:APPROVE_TEST_OBITUARY = "true"
npm test
```

The opt-in approval path uses explicit `TEST ONLY` content and deletes only the unique submission it created after verifying public visibility. Do not target production for this test.

Set `OBITUARY_PUBLIC_URL`, `OBITUARY_DASHBOARD_URL`, and `OBITUARY_LOCAL_API_URL` to use alternate local ports. Non-local UI hosts are refused unless `ALLOW_NONLOCAL_TARGET=true` is explicitly set; the API override must always be local.

The backend defaults to three public obituary submissions per source IP per hour. The local Docker Compose backend raises this limit to 100 per hour so repeated UI automation runs do not exhaust the production-style limit; deployments outside this local stack retain the default unless explicitly configured otherwise.

Playwright traces, screenshots, and videos for failed tests are written under `test-results/`; the HTML report is under `playwright-report/`.

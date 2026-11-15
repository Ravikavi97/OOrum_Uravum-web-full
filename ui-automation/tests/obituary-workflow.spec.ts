import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const dashboardUrl = process.env.OBITUARY_DASHBOARD_URL || 'http://localhost:3001';
const localApiUrl = new URL(process.env.OBITUARY_LOCAL_API_URL || 'http://localhost:4000/api');
const adminEmail = process.env.OBITUARY_ADMIN_EMAIL;
const adminPassword = process.env.OBITUARY_ADMIN_PASSWORD;
const publicUserEmail = process.env.OBITUARY_USER_EMAIL;
const publicUserPassword = process.env.OBITUARY_USER_PASSWORD;
const publicUserName = process.env.OBITUARY_USER_NAME;
const configuredPublicUser = publicUserEmail && publicUserPassword && publicUserName
  ? { email: publicUserEmail, password: publicUserPassword, name: publicUserName }
  : null;
const registerTestUser = process.env.OBITUARY_REGISTER_TEST_USER === 'true';
const approveSubmission = process.env.APPROVE_TEST_OBITUARY === 'true';

function isLocalHost(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

async function routeApiRequestsToLocalBackend(context: BrowserContext) {
  if (!isLocalHost(localApiUrl.hostname)) {
    throw new Error('OBITUARY_LOCAL_API_URL must target localhost.');
  }

  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const sourceUrl = new URL(request.url());
    if (isLocalHost(sourceUrl.hostname)) {
      await route.continue();
      return;
    }

    const sourceHeaders = await request.allHeaders();
    const headers = new Headers();
    for (const name of [
      'accept',
      'access-control-request-headers',
      'access-control-request-method',
      'authorization',
      'content-type',
      'cookie',
      'origin',
    ]) {
      const value = sourceHeaders[name];
      if (value) headers.set(name, value);
    }

    const method = request.method();
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.postDataBuffer();
    const response = await fetch(
      `${localApiUrl.origin}${sourceUrl.pathname}${sourceUrl.search}`,
      { method, headers, body },
    );
    const responseHeaders = Object.fromEntries(response.headers.entries());
    for (const name of ['content-encoding', 'content-length', 'set-cookie', 'transfer-encoding']) {
      delete responseHeaders[name];
    }

    await route.fulfill({
      status: response.status,
      headers: responseHeaders,
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

const uniqueSuffix = `${Date.now()}`;
const obituary = {
  firstName: 'TEST ONLY',
  middleName: 'UI Automation',
  surname: `Obituary ${uniqueSuffix}`,
  otherNames: 'Standalone E2E Verification',
  dateOfBirth: '1945-06-20',
  dateOfDeath: '2020-01-15',
  placeOfBirth: 'Jaffna, Sri Lanka',
  lastResidentialAddress: '14 Automation Test Road, Jaffna, Sri Lanka',
  fatherName: 'TEST ONLY - Father',
  motherName: 'TEST ONLY - Mother',
  maritalStatus: 'married',
  spouseName: 'TEST ONLY - Spouse',
  brothersNames: 'TEST ONLY - Brother One; TEST ONLY - Brother Two',
  sistersNames: 'TEST ONLY - Sister One',
  fatherInLawName: 'TEST ONLY - Father-in-law',
  motherInLawName: 'TEST ONLY - Mother-in-law',
  sonsNames: 'TEST ONLY - Son',
  daughtersNames: 'TEST ONLY - Daughter',
  sonsInLawNames: 'TEST ONLY - Son-in-law',
  daughtersInLawNames: 'TEST ONLY - Daughter-in-law',
  grandchildrenNames: 'TEST ONLY - Grandchild',
  occupations: 'TEST ONLY - Teacher and community volunteer',
  hobbiesInterests: 'TEST ONLY - Reading, gardening, and music',
  communityActivities: 'TEST ONLY - Local community volunteering',
  otherDetails: 'Fictional test data only; this is not a real person.',
  lifeStory: 'TEST ONLY - Fictional submission verifying all public obituary form fields and image upload.',
};

const detailFields = Object.entries(obituary);

test('email registration requires a verification code before signing in', async ({ page }) => {
  await page.route('**/api/public-auth/config', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ googleClientId: '' }),
  }));
  await page.route('**/api/public-auth/register-request-code', (route) => route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Verification code sent. It expires in 10 minutes.' }),
  }));
  let verifiedPayload: Record<string, string> | undefined;
  await page.route('**/api/public-auth/register-verify-code', async (route) => {
    verifiedPayload = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'test-only-verified-user-token',
        user: {
          id: 'test-only-user',
          name: 'TEST ONLY OTP User',
          email: 'otp-ui@example.invalid',
          phone: null,
          avatarUrl: null,
        },
      }),
    });
  });

  await page.goto('/');
  await page.locator('header').getByRole('button', { name: 'உள்நுழைய', exact: true }).click();
  await page.getByRole('button', { name: 'பதிவு செய்ய', exact: true }).click();
  await page.getByPlaceholder('Your name').fill('TEST ONLY OTP User');
  await page.getByPlaceholder('your@email.com').fill('otp-ui@example.invalid');
  await page.getByPlaceholder('Min 6 characters').fill('Testpass123');
  await page.getByPlaceholder('Confirm password').fill('Testpass123');
  await page.getByRole('button', { name: 'Send verification code' }).click();

  await expect(page.getByRole('status')).toContainText('otp-ui@example.invalid');
  await expect(page.getByRole('button', { name: 'Verify email and create account' })).toBeDisabled();
  await page.getByLabel('Email verification code').fill('012345');
  await page.getByRole('button', { name: 'Verify email and create account' }).click();

  await expect(page.locator('header.sticky')).toContainText('TEST ONLY OTP User');
  expect(verifiedPayload?.verificationCode).toBe('012345');
  expect(verifiedPayload?.email).toBe('otp-ui@example.invalid');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('user_token')))
    .toBe('test-only-verified-user-token');
});

test('Google sign-in sends the returned credential to the backend', async ({ page }) => {
  await page.addInitScript(() => {
    type GoogleCallback = (response: { credential: string }) => void;
    type GoogleStub = {
      accounts: {
        id: {
          initialize: (options: { callback: GoogleCallback }) => void;
          renderButton: (parent: HTMLElement) => void;
        };
      };
    };
    const target = window as Window & {
      google?: GoogleStub;
      googleCallback?: GoogleCallback;
      googleInitCount?: number;
    };
    target.google = {
      accounts: {
        id: {
          initialize: (options) => {
            target.googleInitCount = (target.googleInitCount || 0) + 1;
            target.googleCallback = options.callback;
          },
          renderButton: (parent) => {
            const button = document.createElement('button');
            button.textContent = 'Continue with Google';
            button.addEventListener('click', () => target.googleCallback?.({ credential: 'test-google-id-token' }));
            parent.append(button);
          },
        },
      },
    };
  });
  await page.route('**/api/public-auth/config', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ googleClientId: 'test-client-id.apps.googleusercontent.com' }),
  }));
  let submittedCredential = '';
  await page.route('**/api/public-auth/google', async (route) => {
    submittedCredential = (route.request().postDataJSON() as { credential: string }).credential;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'test-only-google-user-token',
        user: {
          id: 'test-google-user',
          name: 'TEST ONLY Google User',
          email: 'google-ui@example.invalid',
          phone: null,
          avatarUrl: null,
        },
      }),
    });
  });

  await page.goto('/');
  await page.locator('header.sticky').getByRole('button', { name: 'உள்நுழைய', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { googleInitCount?: number }).googleInitCount))
    .toBe(1);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('header.sticky').getByRole('button', { name: 'உள்நுழைய', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with Google' }).click();

  await expect(page.locator('header.sticky')).toContainText('TEST ONLY Google User');
  expect(submittedCredential).toBe('test-google-id-token');
  expect(await page.evaluate(() => (window as Window & { googleInitCount?: number }).googleInitCount)).toBe(1);
});

function makeTestPng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=',
    'base64',
  );
}

async function fillPublicObituaryForm(page: Page, fields: Record<string, string>, photoName: string) {
  for (const [field, value] of Object.entries(fields)) {
    const input = page.locator(`#${field}:visible`);
    if (field === 'maritalStatus') {
      await input.selectOption(value);
    } else {
      await input.fill(value);
    }
    await expect(input).toHaveValue(value);
  }

  await page.locator('input[type="file"]').setInputFiles({
    name: photoName,
    mimeType: 'image/png',
    buffer: makeTestPng(),
  });

  const photoPreview = page.getByAltText('Preview');
  await expect(photoPreview).toBeVisible();
  await expect.poll(() => photoPreview.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
}

async function loginAsAdmin(page: Page) {
  await page.goto(`${dashboardUrl}/obituaries`);
  const emailField = page.getByRole('textbox', { name: 'Email' });
  if (await emailField.isVisible().catch(() => false)) {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'Set OBITUARY_ADMIN_EMAIL and OBITUARY_ADMIN_PASSWORD in ui-automation/.env, or provide OBITUARY_STORAGE_STATE.',
      );
    }
    await emailField.fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: 'Login' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Obituaries', exact: true })).toBeVisible();
}

async function loginAsPublicUser(page: Page, user: { email: string; password: string; name: string }) {
  await page.locator('header').getByRole('button', { name: 'உள்நுழைய', exact: true }).click();
  await page.getByRole('button', { name: 'உள்நுழைய', exact: true }).last().click();
  await page.locator('input[type="email"]').last().fill(user.email);
  await page.locator('input[type="password"]').last().fill(user.password);
  await page.locator('input[type="password"]').last().locator('xpath=ancestor::form')
    .getByRole('button', { name: 'உள்நுழைய', exact: true }).click();
  await expect(page.locator('header.sticky')).toContainText(user.name);
}

async function registerTestPublicUser(page: Page) {
  const user = {
    name: `TEST ONLY UI User ${uniqueSuffix}`,
    email: `ui-automation-${uniqueSuffix}@example.invalid`,
    password: `Test-only-${uniqueSuffix}!`,
  };
  await page.locator('header').getByRole('button', { name: 'உள்நுழைய', exact: true }).click();
  await page.getByRole('button', { name: 'பதிவு செய்ய', exact: true }).click();
  await page.getByPlaceholder('Your name').fill(user.name);
  await page.getByPlaceholder('your@email.com').fill(user.email);
  await page.getByPlaceholder('Min 6 characters').fill(user.password);
  await page.getByPlaceholder('Confirm password').fill(user.password);
  await page.getByPlaceholder('Confirm password').locator('xpath=ancestor::form')
    .getByRole('button', { name: 'Send verification code' }).click();
  await expect(page.getByRole('status')).toContainText(user.email);
  console.log('Enter the email verification code in the headed browser, submit it, then resume the test.');
  await page.pause();
  await expect(page.locator('header.sticky')).toContainText(user.name);
  return user;
}

async function openPublishedObituary(page: Page, name: string) {
  await page.goto('/obituary');
  const obituaryCard = page.getByRole('link').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
  await expect(obituaryCard).toBeVisible({ timeout: 30_000 });
  await obituaryCard.click();
}

test('public obituary form prevents a future date of death', async ({ page }) => {
  await page.goto('/submit-obituary');

  const dateOfDeath = page.locator('#dateOfDeath:visible');
  const today = new Date();
  const latestAllowedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const futureDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  await expect(dateOfDeath).toHaveAttribute('max', latestAllowedDate);
  await dateOfDeath.fill(futureDate);
  await expect(page.getByText('Date of death cannot be in the future')).toBeVisible();
  await expect(dateOfDeath).toHaveAttribute('aria-invalid', 'true');
  await expect.poll(() => dateOfDeath.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);
  await expect.poll(() => dateOfDeath.evaluate((input: HTMLInputElement) => input.form?.checkValidity())).toBe(false);
});

test('public obituary form requires date of birth to be before today', async ({ page }) => {
  await page.goto('/submit-obituary');

  const dateOfBirth = page.locator('#dateOfBirth:visible');
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const latestAllowedDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  await expect(dateOfBirth).toHaveAttribute('max', latestAllowedDate);
  await dateOfBirth.fill(todayValue);
  await expect(page.getByText('Date of birth must be before today')).toBeVisible();
  await expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true');
  await expect.poll(() => dateOfBirth.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);

  await dateOfBirth.fill(latestAllowedDate);
  await expect(page.getByText('Date of birth must be before today')).toHaveCount(0);
  await expect(dateOfBirth).toHaveAttribute('aria-invalid', 'false');
  await expect.poll(() => dateOfBirth.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(true);
});

test('public obituary form submits a complete fictional entry', async ({ page, context }) => {
  await routeApiRequestsToLocalBackend(context);
  await page.goto('/submit-obituary');

  const testObituary = { ...obituary, surname: `Public Form ${Date.now()}` };
  await fillPublicObituaryForm(page, testObituary, 'test-only-public-form.png');

  const submitButton = page.getByRole('button', { name: 'Submit Obituary Information' });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByRole('heading', { name: 'Submission Successful!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Obituary Information' })).toHaveCount(0);
});

test('signed-in public user submits an obituary through the frontend', async ({ page, context }) => {
  test.setTimeout(60_000);
  test.skip(
    !configuredPublicUser && !registerTestUser,
    'Configure public-user credentials or set OBITUARY_REGISTER_TEST_USER=true to test signed-in submissions.',
  );

  await routeApiRequestsToLocalBackend(context);
  await page.goto('/submit-obituary');
  const publicUser = registerTestUser
    ? await registerTestPublicUser(page)
    : configuredPublicUser;
  if (!publicUser) throw new Error('Signed-in test user configuration is missing.');

  if (registerTestUser) {
    await page.locator('header').getByText(publicUser.name, { exact: true }).click();
    await page.getByRole('button', { name: 'வெளியேறு', exact: true }).click();
  }
  await loginAsPublicUser(page, publicUser);
  await expect(page.getByRole('status')).toContainText('Submitting as your signed-in account');

  const testObituary = { ...obituary, surname: `Signed In ${Date.now()}` };
  await fillPublicObituaryForm(page, testObituary, 'test-only-signed-in.png');
  await page.getByRole('button', { name: 'Submit Obituary Information' }).click();
  await expect(page.getByRole('heading', { name: 'Submission Successful!' })).toBeVisible();

  if ((adminEmail && adminPassword) || process.env.OBITUARY_STORAGE_STATE) {
    const dashboard = await context.newPage();
    await loginAsAdmin(dashboard);
    await dashboard.getByRole('button', { name: /Pending/ }).click();
    const expectedName = [testObituary.firstName, testObituary.middleName, testObituary.surname].join(' ');
    const submissionRow = dashboard.locator('tr').filter({ hasText: expectedName }).first();
    await expect(submissionRow).toContainText(publicUser.name);
    await expect(submissionRow).toContainText(publicUser.email);
  }
});

test('public submission is persisted and reviewable in the publisher dashboard', async ({ page, context }) => {
  test.skip(
    (!adminEmail || !adminPassword) && !process.env.OBITUARY_STORAGE_STATE,
    'Configure local admin credentials or an authenticated storage state before submitting a test obituary.',
  );

  await routeApiRequestsToLocalBackend(context);
  await page.goto('/submit-obituary');
  if (configuredPublicUser) {
    await loginAsPublicUser(page, configuredPublicUser);
  }

  await fillPublicObituaryForm(page, obituary, 'test-only-public-form.png');

  await page.getByRole('button', { name: 'Submit Obituary Information' }).click();

  await expect(page.getByRole('heading', { name: 'Submission Successful!' })).toBeVisible();

  const dashboard = await context.newPage();
  await loginAsAdmin(dashboard);
  await dashboard.getByRole('button', { name: /Pending/ }).click();

  const expectedName = `${obituary.firstName} ${obituary.middleName} ${obituary.surname}`;
  const submissionRow = dashboard.locator('tr').filter({ hasText: expectedName }).first();
  await expect(submissionRow).toContainText('PENDING');
  await expect(submissionRow).toContainText(
    configuredPublicUser?.email ?? 'Anonymous',
  );
  await submissionRow.getByRole('button', { name: 'Review details' }).click();

  const review = dashboard.locator('tr').filter({ hasText: 'Submission details' }).first();
  await expect(review).toBeVisible();
  for (const [field, value] of detailFields) {
    const labels: Record<string, string> = {
      firstName: 'First name',
      middleName: 'Middle name',
      surname: 'Surname',
      otherNames: 'Other names',
      dateOfBirth: 'Date of birth',
      dateOfDeath: 'Date of death',
      placeOfBirth: 'Place of birth',
      lastResidentialAddress: 'Last residential address',
      fatherName: 'Father',
      motherName: 'Mother',
      maritalStatus: 'Marital status',
      spouseName: 'Spouse',
      brothersNames: 'Brothers',
      sistersNames: 'Sisters',
      fatherInLawName: 'Father-in-law',
      motherInLawName: 'Mother-in-law',
      sonsNames: 'Sons',
      daughtersNames: 'Daughters',
      sonsInLawNames: 'Sons-in-law',
      daughtersInLawNames: 'Daughters-in-law',
      grandchildrenNames: 'Grandchildren',
      occupations: 'Occupations',
      hobbiesInterests: 'Hobbies and interests',
      communityActivities: 'Community activities',
      otherDetails: 'Other details',
      lifeStory: 'Life story',
    };
    const displayedValue = field === 'dateOfBirth' || field === 'dateOfDeath'
      ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : value;
    await expect(review.getByText(labels[field], { exact: true }).locator('..')).toContainText(displayedValue);
  }

  const detailPhoto = review.locator('img').first();
  await expect(detailPhoto).toBeVisible();
  await expect.poll(() => detailPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await submissionRow.getByRole('button', { name: 'Prepare publication' }).click();
  const publicationName = dashboard.getByLabel('Publication name');
  const publicationContent = dashboard.getByLabel('Publication content (written by admin)');
  await expect(publicationName).toHaveValue(expectedName);
  await expect(publicationContent).toHaveValue('');
  await expect(dashboard.getByLabel('Marital status')).toHaveValue(obituary.maritalStatus);
  await expect(dashboard.getByLabel('Submitted life story')).toHaveValue(obituary.lifeStory);

  const publicationPhoto = dashboard.getByAltText('Obituary photo preview');
  await expect(publicationPhoto).toBeVisible();
  await expect.poll(() => publicationPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  if (approveSubmission) {
    await publicationContent.fill(`TEST ONLY - editorial approval ${uniqueSuffix}`);
    await dashboard.getByRole('button', { name: 'Save publication and approve' }).click();
    await expect(dashboard.getByText('Obituary reviewed and approved for publication')).toBeVisible();

    await openPublishedObituary(page, expectedName);
    const publicArticle = page.locator('article.rounded-2xl.bg-card-bg').filter({ visible: true }).first();
    await expect(publicArticle.getByText('Publication name', { exact: true })).toBeVisible();
    await expect(publicArticle.getByRole('heading', { name: expectedName, level: 1 })).toBeVisible();
    await expect(publicArticle.getByRole('heading', { name: 'Publication content' })).toBeVisible();
    await expect(publicArticle.getByText(`TEST ONLY - editorial approval ${uniqueSuffix}`)).toBeVisible();
    await expect(publicArticle.getByText('Date of birth', { exact: true }).locator('..')).toContainText(
      new Date(`${obituary.dateOfBirth}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' }),
    );
    await expect(publicArticle.getByText('Date of death', { exact: true }).locator('..')).toContainText(
      new Date(`${obituary.dateOfDeath}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' }),
    );
    await expect(publicArticle.getByText('Last residential address', { exact: true }).locator('..')).toContainText(
      obituary.lastResidentialAddress,
    );
    const publishedPhoto = publicArticle.locator('img').first();
    await expect(publishedPhoto).toBeVisible();
    await expect.poll(() => publishedPhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await dashboard.goto(`${dashboardUrl}/obituaries`);
    const approvedRow = dashboard.locator('tr').filter({ hasText: expectedName }).first();
    await expect(approvedRow).toContainText('APPROVED');
    await approvedRow.getByRole('button', { name: 'Delete' }).click();
    const deleteDialog = dashboard.getByRole('dialog', { name: 'Delete obituary?' });
    await expect(deleteDialog).toContainText(expectedName);
    await deleteDialog.getByRole('button', { name: 'Delete Obituary' }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(dashboard.locator('tr').filter({ hasText: expectedName })).toHaveCount(0);
  } else {
    await dashboard.getByRole('button', { name: 'Cancel' }).click();
    await expect(submissionRow).toContainText('PENDING');
  }
});

test('public submissions can be approved with a publisher-uploaded image', async ({ context }) => {
  test.skip(
    (!adminEmail || !adminPassword) && !process.env.OBITUARY_STORAGE_STATE,
    'Configure local admin credentials or an authenticated storage state before creating a test obituary.',
  );

  const uniqueName = `TEST ONLY Publisher Upload ${uniqueSuffix}`;
  await routeApiRequestsToLocalBackend(context);
  const publicPage = await context.newPage();
  await publicPage.goto('/submit-obituary');
  await publicPage.locator('#firstName').fill('TEST ONLY');
  await publicPage.locator('#surname').fill(`Publisher Upload ${uniqueSuffix}`);
  await publicPage.locator('#dateOfBirth').fill('1945-06-20');
  await publicPage.locator('#dateOfDeath').fill('2020-01-15');
  await publicPage.locator('#lastResidentialAddress').fill('TEST ONLY - Publisher Upload Test Address');

  await publicPage.getByRole('button', { name: 'Submit Obituary Information' }).click();
  await expect(publicPage.getByRole('heading', { name: 'Submission Successful!' })).toBeVisible();

  const dashboard = await context.newPage();
  await loginAsAdmin(dashboard);

  await dashboard.getByRole('button', { name: /Pending/ }).click();
  const pendingRow = dashboard.locator('tr').filter({ hasText: uniqueName }).first();
  await expect(pendingRow).toContainText('PENDING');
  await pendingRow.getByRole('button', { name: 'Review details' }).click();
  await pendingRow.getByRole('button', { name: 'Prepare publication' }).click();
  await dashboard.getByLabel('Publication content (written by admin)').fill(
    `TEST ONLY - publisher dashboard image upload verification ${uniqueSuffix}`,
  );
  await dashboard.locator('#obituary-photo').setInputFiles({
    name: 'publisher-dashboard-test.png',
    mimeType: 'image/png',
    buffer: makeTestPng(),
  });

  const imagePreview = dashboard.getByAltText('Obituary photo preview');
  await expect(imagePreview).toBeVisible();
  await expect.poll(() => imagePreview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await dashboard.getByRole('button', { name: 'Save publication and approve' }).click();
  await expect(dashboard.getByText('Obituary reviewed and approved for publication')).toBeVisible();

  await openPublishedObituary(publicPage, uniqueName);
  const article = publicPage.locator('article.rounded-2xl.bg-card-bg').filter({ visible: true }).first();
  await expect(article.getByRole('heading', { name: uniqueName, level: 1 })).toBeVisible();
  await expect(article.getByText(`TEST ONLY - publisher dashboard image upload verification ${uniqueSuffix}`)).toBeVisible();
  await expect(article.getByText('Date of birth', { exact: true }).locator('..')).toContainText('20/06/1945');
  await expect(article.getByText('Date of death', { exact: true }).locator('..')).toContainText('15/01/2020');
  await expect(article.getByText('Last residential address', { exact: true }).locator('..')).toContainText(
    'TEST ONLY - Publisher Upload Test Address',
  );
  await expect(article.getByText('Father', { exact: true })).toHaveCount(0);
  const publishedImage = article.locator('img').first();
  await expect(publishedImage).toBeVisible();
  await expect.poll(() => publishedImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await dashboard.getByRole('button', { name: /Approved/ }).click();
  const createdRow = dashboard.locator('tr').filter({ hasText: uniqueName }).first();
  await expect(createdRow).toContainText('APPROVED');
  await createdRow.getByRole('button', { name: 'Delete' }).click();
  const deleteDialog = dashboard.getByRole('dialog', { name: 'Delete obituary?' });
  await expect(deleteDialog).toContainText(uniqueName);
  await deleteDialog.getByRole('button', { name: 'Delete Obituary' }).click();
  await expect(deleteDialog).toHaveCount(0);
  await expect(dashboard.locator('tr').filter({ hasText: uniqueName })).toHaveCount(0);
});

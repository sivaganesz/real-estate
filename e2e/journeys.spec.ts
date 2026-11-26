import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** Signs in with the demo buttons on the login page, like a first-time visitor would. */
/** Opens a customer from the Leads list. Wide screens show them beside the list first. */
async function openLead(page: Page, name: RegExp) {
  await page.getByRole('link', { name }).first().click();
  const full = page.getByRole('link', { name: /Open full lead page/ });
  if (await full.isVisible().catch(() => false)) await full.click();
}

async function signIn(page: Page, who: 'Admin' | 'Sales manager' | 'Sales executive') {
  await page.goto('/login');
  await page.getByRole('button', { name: who, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)|day./);
}

test.describe('sales executive', () => {
  test('starts the day on Today and works a new lead @phone', async ({ page }) => {
    await signIn(page, 'Sales executive');
    await expect(page.getByText('Your day')).toBeVisible();
    await expect(page.getByText('Follow-ups')).toBeVisible();
    // Executives don't load properties or manage settings.
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);

    // The phone run follows the desktop run on the same data, so open him via Leads.
    await page.goto('/leads?q=Vignesh');
    await openLead(page, /Vignesh Babu/);
    await expect(page.getByRole('heading', { name: 'Vignesh Babu' })).toBeVisible();
    await page.getByRole('button', { name: 'Log a call' }).click();
    await page.getByRole('button', { name: 'Interested', exact: true }).first().click();
    await page.getByPlaceholder(/What was said/).fill('Wants a 2 BHK near Porur, budget 65 lakhs');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    // The phone run follows the desktop run on the same data, so this call may be the second one.
    await expect(page.getByText('Logged', { exact: true })).toBeVisible();
    await expect(page.getByText('Call · Interested').first()).toBeVisible();
    await expect(page.locator('h1 + span, h1 ~ span').filter({ hasText: 'Contacted' }).first()).toBeVisible();
  });

  test('sees why properties fit a customer and sends two on WhatsApp', async ({ page }) => {
    await signIn(page, 'Sales executive');
    await page.goto('/leads?q=Irfan');
    await openLead(page, /Mohammed Irfan/);
    await expect(page.getByText('Strong fit').first()).toBeVisible();
    await expect(page.getByText(/within budget/).first()).toBeVisible();
    const boxes = page.getByRole('button', { name: 'Select' });
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await page.getByRole('button', { name: /Send to Mohammed/ }).click();
    await expect(page.locator('textarea').last()).toHaveValue(/Hi Mohammed, as discussed, here are 2 options/);
    await expect(page.getByRole('button', { name: 'Open WhatsApp' })).toBeVisible();
  });

  test('books a meeting from the calendar', async ({ page }) => {
    await signIn(page, 'Sales executive');
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'New appointment' }).click();
    await page.getByPlaceholder('Customer name or phone').fill('Usha');
    await page.getByRole('button', { name: /Usha Rani/ }).click();
    await page.getByRole('button', { name: 'Meeting', exact: true }).click();
    await page.getByPlaceholder(/What it’s about/).fill('Discuss Saravanampatti payment plan');
    await page.getByRole('button', { name: 'Tomorrow 5 pm' }).click();
    await page.getByRole('button', { name: 'Book it', exact: true }).click();
    await expect(page.getByText(/Meeting with Usha booked for Tomorrow/)).toBeVisible();
    await expect(page.getByText('Usha Rani').first()).toBeVisible();
  });

  test('can’t open someone else’s customer', async ({ page }) => {
    await signIn(page, 'Sales executive');
    await page.goto('/leads?q=Suresh');
    await expect(page.getByText(/No open leads match/)).toBeVisible();
  });
});

test.describe('sales manager', () => {
  test('adds a property by describing it, then publishes', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/properties?add=1');
    await page.getByPlaceholder(/2 BHK flat for sale in Porur/).fill('3 BHK flat for sale in Kodambakkam, Chennai, 1350 sq.ft on the 4th floor, east facing, price 1.15 Cr, lift and car parking');
    await page.getByRole('button', { name: 'Fill the form' }).click();
    await expect(page.getByLabel(/Price/).first()).toHaveValue('11500000');
    await page.getByRole('button', { name: 'Save & publish' }).click();
    await expect(page.getByRole('heading', { name: /3 BHK Apartment in Kodambakkam/ })).toBeVisible();
    await expect(page.getByText('₹1.15 Cr').first()).toBeVisible();
    await expect(page.getByText('Available').first()).toBeVisible();
  });

  test('walks through a property’s tabs: price, matching buyers, history', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/properties?q=2 BHK resale in Porur');
    await page.getByRole('link', { name: '2 BHK resale in Porur' }).first().click();
    await expect(page.getByRole('heading', { name: /2 BHK resale in Porur/ })).toBeVisible();
    await expect(page.getByText('Price check')).toBeVisible();
    await page.getByRole('tab', { name: /^Price/ }).click();
    await expect(page.getByText('Total for the buyer')).toBeVisible();
    await expect(page.getByText(/side by side/)).toBeVisible();
    await page.getByRole('tab', { name: /Matching customers/ }).click();
    await expect(page.getByText(/customers? fits? this property/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Send to / }).first()).toBeVisible();
    await page.getByRole('tab', { name: /History/ }).click();
    await expect(page.getByRole('button', { name: /^All · / })).toBeVisible();
  });

  test('imports an owner’s messy sheet through the Check screen', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/properties/import');
    await page.locator('input[type=file]').setInputFiles(path.resolve('docs/samples/owner-sheet-sri-balaji.xlsx'));
    await page.getByRole('button', { name: 'Read the file' }).click();
    await expect(page.getByText(/Skipped 3 lines above the headings/)).toBeVisible();
    await page.getByRole('button', { name: /Looks right/ }).click();
    await page.getByPlaceholder('e.g. Chennai').fill('Chennai');
    await page.getByRole('button', { name: 'Apply to all' }).click();
    await expect(page.getByRole('button', { name: /^Ready \d/ })).toBeVisible();
    await page.getByRole('button', { name: /^Import \d+ rows?$/ }).click();
    await expect(page.getByText('Import finished')).toBeVisible();
    await expect(page.getByText(/\d+ added/)).toBeVisible();
  });

  test('approves a discount waiting for them', async ({ page }) => {
    await signIn(page, 'Sales manager');
    // The Decisions tile; the headline above it says it too.
    await expect(page.getByText(/^\d+ waiting for you$/)).toBeVisible();
    await page.goto('/deals');
    await page.getByRole('button', { name: /Price approval/ }).click();
    await page.getByRole('button', { name: /^Approve ₹/ }).click();
    await expect(page.getByText('Agreed').first()).toBeVisible();
  });

  test('sees each deal’s step and what happens next', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/deals');
    await expect(page.getByText('A deal is one customer buying one property')).toBeVisible();
    await page.getByRole('button', { name: /^Step 1: Agree the price/ }).click();
    await expect(page.getByText(/Step 1: Agree the price/)).toBeVisible();
    await expect(page.getByText(/Your move:/).first()).toBeVisible();
  });

  test('drags nothing: moving a lead without evidence asks for it', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/leads?q=Revathi');
    await openLead(page, /Revathi Shankar/);
    await page.getByRole('button', { name: 'Move to Contacted' }).click();
    await expect(page.getByText('Log the first conversation before moving on')).toBeVisible();
  });
});

test.describe('assistant (offline mode)', () => {
  test('answers business questions with the records behind them @phone', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.getByRole('button', { name: 'Assistant' }).click();
    const box = page.getByPlaceholder('Ask, search or tell me what to do…');
    await box.fill('Which projects have low inventory movement?');
    await box.press('Enter');
    await expect(page.getByText(/Palm Grove Villas/).first()).toBeVisible();
    await box.fill('Find 2 BHK apartments under 70 lakhs in Porur');
    await box.press('Enter');
    await expect(page.getByText(/^Found \d+/)).toBeVisible();
  });
});

test.describe('assistant page', () => {
  test('asks from the full page and keeps the chat', async ({ page }) => {
    await signIn(page, 'Sales executive');
    await page.getByRole('link', { name: 'AI Assistant' }).click();
    await expect(page.getByText(/How can I help with your/)).toBeVisible();
    await page.getByRole('button', { name: 'Leads needing attention' }).click();
    await expect(page.getByText('Which of my leads need attention today?')).toBeVisible();
    await expect(page.getByRole('link', { name: /Mohammed Irfan/ }).first()).toBeVisible();
    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page.getByText(/How can I help with your/)).toBeVisible();
    await page.getByRole('button', { name: 'Past chats' }).click();
    await page.getByRole('button', { name: /^Which of my leads need attention today/ }).click();
    await expect(page.getByRole('link', { name: /Mohammed Irfan/ }).first()).toBeVisible();
  });
});

test('buyer share page shows no internal notes', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', { data: { email: 'manager@estate.test', password: 'demo1234' } });
  expect(login.ok()).toBeTruthy();
  const list = await (await request.get('/api/properties?q=Uthandi&smart=false')).json();
  const id = list.items[0].id as string;
  await request.patch(`/api/properties/${id}`, { data: { price: 21000000, details: { landArea: 2400 } } });
  await request.post(`/api/properties/${id}/listing`, { data: { to: 'live' } });
  const share = await (await request.post(`/api/properties/${id}/share`)).json();
  await page.goto(share.path);
  await expect(page.getByText('₹2.1 Cr')).toBeVisible();
  await expect(page.getByText(/call after 6 pm/)).toHaveCount(0);
});

test.describe('projects', () => {
  test('creates a plotted layout in the wizard and publishes it', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /Plotted layout/ }).click();
    await page.getByLabel('Project name *').fill('Lake View Plots');
    await page.getByLabel('City *').fill('Chennai');
    await page.getByLabel('Locality *').fill('Vandalur');
    await page.getByRole('button', { name: 'Ready for registration' }).click();
    await page.getByRole('button', { name: /Next: blocks & plots/ }).click();
    await page.getByRole('button', { name: 'Add block' }).click();
    await page.getByLabel('Base rate (₹ per sq.ft)').fill('2800');
    await expect(page.getByText('10 plots')).toBeVisible();
    await expect(page.getByText(/Every plot: ₹33.6 L – ₹35.28 L/)).toBeVisible();
    await page.getByRole('button', { name: 'Publish project' }).click();
    await expect(page.getByRole('heading', { name: 'Lake View Plots' })).toBeVisible();
    await expect(page.getByText('All plots')).toBeVisible();
    await page.getByRole('button', { name: 'Master plan' }).click();
    await expect(page.getByText('40 FT MAIN ROAD')).toBeVisible();
  });

  test('starts a deal by clicking a unit on the layout', async ({ page }) => {
    await signIn(page, 'Sales manager');
    await page.goto('/properties?tab=projects');
    await page.getByRole('link', { name: 'Green Meadows' }).click();
    await page.getByRole('button', { name: /^A503/ }).click();
    await page.getByRole('button', { name: 'Start a deal for a customer' }).click();
    await page.getByPlaceholder('Customer name or phone').fill('Irfan');
    await page.getByRole('button', { name: /Mohammed Irfan/ }).click();
    await page.getByRole('button', { name: 'Start negotiation' }).click();
    await expect(page.getByText('Negotiating').first()).toBeVisible();
    await expect(page.getByText(/Customer: Mohammed Irfan/)).toBeVisible();
  });
});

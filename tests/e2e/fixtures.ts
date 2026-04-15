import { test as base } from '@playwright/test';
import { resetData } from './helpers/resetData';

export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({ request }, use) => {
      await request.post('/graphql', {
        data: { query: 'mutation { clearTestNow { id } }' },
      });
      resetData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

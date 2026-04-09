import { test as base } from '@playwright/test';
import { resetData } from './helpers/resetData';

export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({}, use) => {
      resetData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

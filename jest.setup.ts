// Force the unencrypted dev code path in src/lib/db.ts during tests so importing
// modules that transitively depend on @/lib/db (e.g., src/lib/priceAnomalyLog.ts)
// doesn't throw the KMS_KEY_ID guard. Tests should never hit real AWS.
process.env.NODE_ENV = 'development';

import '@testing-library/jest-dom';

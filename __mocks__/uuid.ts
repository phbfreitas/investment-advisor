// Jest mock for uuid (ESM-only package).
// uuid v13 ships as ESM and breaks Jest's CJS transform pipeline. Test code
// only ever needs v4 to produce a string; the mock returns deterministic-ish
// values so test snapshots don't churn between runs.
let counter = 0;
export const v4 = (): string => {
    counter += 1;
    return `00000000-0000-0000-0000-${counter.toString().padStart(12, "0")}`;
};
export default { v4 };

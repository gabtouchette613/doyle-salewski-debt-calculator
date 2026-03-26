/**
 * calculator.js — Pure JS financial calculation engine.
 * Zero imports. Zero framework dependencies. Named exports only.
 */

export const DEBT_TYPE_RATES = {
  'credit-card': 0.1999,
  'loc':         0.0850,
  'cra':         0.0900,
  'student':     0.0750,
  'payday':      0.2999,
  'personal':    0.1499,
  'other':       0.1999,
};

/**
 * Calculates a weighted average interest rate from a debt breakdown.
 * Falls back to DEFAULT_RATE if no items provided.
 * @param {Array} debtItems - [{ type: string, amount: number }]
 * @returns {number} weighted annual rate as decimal
 */
export function calcBlendedRate(debtItems) {
  const DEFAULT_RATE = 0.2199;
  if (!debtItems || debtItems.length === 0) return DEFAULT_RATE;

  const validItems = debtItems.filter(d => d.amount > 0);
  if (validItems.length === 0) return DEFAULT_RATE;

  const totalDebt = validItems.reduce((sum, d) => sum + d.amount, 0);
  if (totalDebt === 0) return DEFAULT_RATE;

  const weightedSum = validItems.reduce((sum, d) => {
    const rate = DEBT_TYPE_RATES[d.type] ?? DEFAULT_RATE;
    return sum + (d.amount * rate);
  }, 0);

  return weightedSum / totalDebt;
}

/**
 * Runs all debt relief calculations.
 * @param {Object} inp - form inputs
 * @returns {Object} complete results object
 */
export function calcResults(inp) {
  const debt      = parseFloat(inp.debt)     || 0;
  const income    = parseFloat(inp.income)   || 0;
  const expenses  = parseFloat(inp.expenses) || 0;
  const province  = inp.province             || 'ON';
  const debtItems = inp.debtItems            || [];

  // Rate — use weighted if advanced breakdown provided
  const annualRate     = calcBlendedRate(debtItems);
  const isAdvancedRate = debtItems.length > 0 &&
    debtItems.some(d => d.amount > 0);
  const monthlyRate    = annualRate / 12;

  // Derived metrics
  const monthlyInterest     = Math.round(debt * monthlyRate);
  const dailyInterest       = Math.round((debt * annualRate / 365) * 100) / 100;
  const annualInterest      = Math.round(debt * annualRate);
  const dti                 = income > 0
    ? Math.round((debt / (income * 12)) * 100)
    : 0;
  const surplus             = Math.max(0, income - expenses);
  const interestPctOfIncome = income > 0
    ? Math.round((monthlyInterest / income) * 100)
    : 0;

  const yr = new Date().getFullYear();

  // ── Do Nothing ─────────────────────────────────────────────────
  // Simulate actual month-by-month minimum payment amortization
  const MIN_PMT_PCT = 0.025;
  let nBal = debt, nPaid = 0, nInterestPaid = 0, nMonths = 0;
  while (nBal > 0.5 && nMonths < 600) {
    const int = nBal * monthlyRate;
    const pmt = Math.min(Math.max(nBal * MIN_PMT_PCT, 10), nBal + int);
    nInterestPaid += int;
    nBal = Math.max(0, nBal + int - pmt);
    nPaid += pmt;
    nMonths++;
  }
  const nTotal    = Math.round(nPaid);
  const nInterest = Math.round(nInterestPaid);
  const nPayment  = Math.round(Math.max(debt * MIN_PMT_PCT, 10));

  // ── Consumer Proposal ──────────────────────────────────────────
  // Settle ~30% of principal, 0% interest, 60 months
  // Note: actual % determined by LIT consultation
  const PROPOSAL_RATE = 0.30;
  const pTotal   = Math.round(debt * PROPOSAL_RATE);
  const pMonths  = 60;
  const pPayment = Math.round(pTotal / pMonths);

  // ── Debt Management Plan ───────────────────────────────────────
  // 100% principal, 0% interest (negotiated), 5% admin fee, 60 months
  const DMP_ADMIN_FEE = 0.055;
  const dmpTotal   = Math.round(debt * (1 + DMP_ADMIN_FEE));
  const dmpMonths  = 60;
  const dmpPayment = Math.round(dmpTotal / dmpMonths);

  // ── Consolidation Loan ─────────────────────────────────────────
  // 16.99% APR, 60 months, requires 650+ credit score
  const CONS_RATE   = 0.1699;
  const cR          = CONS_RATE / 12;
  const cN          = 60;
  const consPayment = Math.round(
    (debt * cR * Math.pow(1 + cR, cN)) / (Math.pow(1 + cR, cN) - 1)
  );
  const consTotal    = consPayment * cN;
  const consInterest = consTotal - debt;

  const options = [
    {
      id:                   'nothing',
      color:                '#dc2626',
      total:                nTotal,
      months:               nMonths,
      payment:              nPayment,
      year:                 yr + Math.ceil(nMonths / 12),
      savings:              0,
      interestPaid:         nInterest,
      principalPerPayment:  Math.max(0, nPayment - monthlyInterest),
      interestPerPayment:   monthlyInterest,
      scary:                true,
      creditRating:         'R9',
      creditDesc:           'Stays damaged for the full 27-year duration',
      assumption:           `${(annualRate * 100).toFixed(2)}% APR, 2.5% minimum payment`,
    },
    {
      id:                   'proposal',
      color:                '#1061ED',
      total:                pTotal,
      months:               pMonths,
      payment:              pPayment,
      year:                 yr + 5,
      savings:              nTotal - pTotal,
      interestPaid:         0,
      principalPerPayment:  pPayment,
      interestPerPayment:   0,
      recommended:          true,
      creditRating:         'R7',
      creditDesc:           'Removed 3 years after completion (~6 yrs from filing)',
      assumption:           `Est. ~${Math.round(PROPOSAL_RATE * 100)}% of debt settled, 0% interest, 60 months. Actual % set by LIT.`,
    },
    {
      id:                   'dmp',
      color:                '#d97706',
      total:                dmpTotal,
      months:               dmpMonths,
      payment:              dmpPayment,
      year:                 yr + 5,
      savings:              nTotal - dmpTotal,
      interestPaid:         0,
      principalPerPayment:  dmpPayment,
      interestPerPayment:   0,
      creditRating:         'R7',
      creditDesc:           'Removed 2 years after completion',
      assumption:           `100% principal + ${Math.round(DMP_ADMIN_FEE * 100)}% admin fee, 0% interest, 60 months`,
    },
    {
      id:                   'consolidation',
      color:                '#0891b2',
      total:                consTotal,
      months:               cN,
      payment:              consPayment,
      year:                 yr + 5,
      savings:              nTotal - consTotal,
      interestPaid:         consInterest,
      principalPerPayment:  Math.round(debt / cN),
      interestPerPayment:   Math.round(consInterest / cN),
      creditRating:         'Improves',
      creditDesc:           'On-time payments rebuild credit over time',
      assumption:           `${(CONS_RATE * 100).toFixed(2)}% APR, 60-month term. Requires 650+ credit score.`,
    },
  ];

  return {
    debt,
    income,
    expenses,
    surplus,
    province,
    annualRate,
    isAdvancedRate,
    monthlyInterest,
    dailyInterest,
    annualInterest,
    dti,
    interestPctOfIncome,
    debtItems,
    options,
  };
}

/**
 * Formats a number as Canadian currency.
 * @param {number} n
 * @returns {string} e.g. "$45,000"
 */
export function fmtC(n) {
  return new Intl.NumberFormat('en-CA', {
    style:                 'currency',
    currency:              'CAD',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * Formats a number as Canadian currency with 2 decimal places.
 * @param {number} n
 * @returns {string} e.g. "$8.24"
 */
export function fmtC2(n) {
  return new Intl.NumberFormat('en-CA', {
    style:                 'currency',
    currency:              'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

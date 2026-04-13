/**
 * Illustrative patronage / dividend-style estimates for the landing earnings simulator.
 * Single source of truth — keep in sync with copy that references example percentages.
 */

export const EST_REFUND_RATE = 0.05;
export const EST_DIVIDEND_RATE = 0.05;

/**
 * @param {object} input
 * @param {number} input.weeklySpend
 * @param {number} input.shareCapital
 * @param {number} input.monthlyContribution
 */
export function computeEarningsProjection({ weeklySpend, shareCapital, monthlyContribution }) {
  const annualRefund = weeklySpend * 4 * 12 * EST_REFUND_RATE;
  const averageAnnualCapital = shareCapital + monthlyContribution * 6;
  const annualDividend = averageAnnualCapital * EST_DIVIDEND_RATE;
  const totalAnnualEarnings = annualRefund + annualDividend;
  const totalEquityYearOne = shareCapital + monthlyContribution * 12;
  return {
    annualRefund,
    averageAnnualCapital,
    annualDividend,
    totalAnnualEarnings,
    totalEquityYearOne,
  };
}

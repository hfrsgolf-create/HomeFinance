import { BondWinning, BondYearlyWinning } from './types';

export interface BondYearTotal {
  year: number;
  total: number;
}

export function buildBondYearTotals(winnings: BondWinning[], yearly: BondYearlyWinning[]): BondYearTotal[] {
  const monthlyByYear = new Map<number, number>();
  for (const w of winnings) {
    const year = Number(w.date.slice(0, 4));
    monthlyByYear.set(year, (monthlyByYear.get(year) ?? 0) + Number(w.amount));
  }
  const manualByYear = new Map(yearly.map((y) => [y.year, Number(y.amount)]));
  const years = new Set([...monthlyByYear.keys(), ...manualByYear.keys()]);

  return [...years]
    .map((year): BondYearTotal => ({
      year,
      total: monthlyByYear.get(year) ?? manualByYear.get(year) ?? 0,
    }))
    .sort((a, b) => b.year - a.year);
}

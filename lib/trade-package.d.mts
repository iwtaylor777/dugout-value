export const MAX_CASH_AMOUNT: 1000;
export const PACKAGE_SHARED_RISK: 0.4;
export function normalizeCashAmount(value: unknown): number;
export function packageValue<T extends object>(
  ids: string[],
  cash: unknown,
  values: Record<string, T | undefined>,
  field?: keyof T,
): number;
export function packageRange<
  T extends { total?: number; low?: number; high?: number },
>(
  ids: string[],
  cash: unknown,
  values: Record<string, T | undefined>,
  sharedRisk?: number,
): { total: number; low: number; high: number; sharedRisk: number };
export function packageConsolidation<T extends { total?: number }>(
  leftIds: string[],
  leftCash: unknown,
  rightIds: string[],
  rightCash: unknown,
  values: Record<string, T | undefined>,
): null | {
  headlinerSide: "left" | "right";
  headlinerId: string;
  headlinerValue: number;
  returningHeadlinerId: string;
  returningHeadlinerValue: number;
};

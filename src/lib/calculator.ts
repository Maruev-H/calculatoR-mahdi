/** Наценка, % от суммы рассрочки — взнос < 25 % от цены. */
export const RATES: Record<number, number> = {
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 45,
};

/** Наценка, % от суммы рассрочки — взнос ≥ 25 % от цены. */
export const RATES_WITH_DOWN: Record<number, number> = {
  3: 9,
  4: 12,
  5: 15,
  6: 18,
  7: 21,
  8: 24,
  9: 27,
  10: 30,
  11: 33,
  12: 35,
};

export const MONTH_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 3);

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

const DOWN_THRESHOLD_RECOMMENDED = 0.25;
const DOWN_THRESHOLD_MIN = 0.5;

/** Шаг кратности итога: (месяцы + (взнос > minDown ? 1 : 0)) × 50 ₽. */
export function getTotalPayStep(
  months: number,
  down: number,
  minDown: number,
): number {
  return (months + (down > minDown ? 1 : 0)) * 50;
}

/** Округление итога вверх до кратного step. */
export function roundTotalPayUp(rawTotal: number, step: number): number {
  if (!isFinite(rawTotal) || step <= 0) return rawTotal;
  return Math.ceil(rawTotal / step) * step;
}

export function getRateForMonths(
  months: number,
  price: number,
  down: number,
): number {
  const table =
    down < price * DOWN_THRESHOLD_RECOMMENDED ? RATES : RATES_WITH_DOWN;
  return table[months] ?? 0;
}

export function getMaxDown(price: number): number {
  return Math.floor(price / 50) * 50;
}

/** 25 % от суммы рассрочки (стоимости товара), вверх до кратного 50 ₽. */
export function getRecommendedDown(price: number): number {
  if (!isFinite(price)) return 0;
  const exact = price * 0.25;
  const x = Math.ceil(exact / 50) * 50;
  const max50 = getMaxDown(price);
  return Math.min(x, max50);
}

export function isMultipleOf50Rub(n: number): boolean {
  if (!isFinite(n) || n < 0) return false;
  const x = Math.round(n);
  if (Math.abs(n - x) > 1e-6) return false;
  return x % 50 === 0;
}

export function parsePrice(value: string): number {
  const v = parseFloat(value.replace(",", "."));
  return isFinite(v) && v > 0 ? v : NaN;
}

export function parseDown(value: string): number {
  const v = parseFloat(value.replace(",", "."));
  return isFinite(v) ? v : 0;
}

export type CalcSuccess = {
  ok: true;
  price: number;
  hasDown: boolean;
  down: number;
  months: number;
  rate: number;
  markupAmount: number;
  totalPay: number;
  monthly: number;
};

export type CalcError = {
  ok: false;
  monthlyMessage?: string;
};

export type CalcResult = CalcSuccess | CalcError;

export function isCalcError(result: CalcResult): result is CalcError {
  return result.ok === false;
}

export function calculate(
  price: number,
  months: number,
  hasDown: boolean,
  downRaw: number,
): CalcResult {
  if (!isFinite(price)) {
    return { ok: false };
  }

  let down = 0;
  if (hasDown) {
    down = downRaw;
    if (!isFinite(down)) down = 0;
    const maxDown = getMaxDown(price);

    if (down > price) {
      return {
        ok: false,
        monthlyMessage: "Взнос не может превышать стоимость",
      };
    }
    if (!isMultipleOf50Rub(down)) {
      return {
        ok: false,
        monthlyMessage: "Взнос должен быть кратен 50 ₽",
      };
    }
    if (down > maxDown) {
      return {
        ok: false,
        monthlyMessage: `Макс. взнос — ${formatMoney(maxDown)} (кратно 50 ₽)`,
      };
    }
  }

  let principal = price;

  const recommendedDown = getRecommendedDown(price);
  const minDown = price * DOWN_THRESHOLD_MIN;

  if (down > minDown && down < recommendedDown) {
    principal = price - down;
  }

  const rate = getRateForMonths(months, price, down);
  let markupAmount = principal * (rate / 100);

  if (hasDown && down !== recommendedDown) {
    const referenceFinanced = price - recommendedDown;
    if (referenceFinanced > 0) {
      const baseRate = getRateForMonths(months, price, recommendedDown);
      const baseMarkup = price * (baseRate / 100);
      markupAmount = baseMarkup * ((price - down) / referenceFinanced);
    }
  }

  const rawTotalPay = price + markupAmount;
  const step = getTotalPayStep(months, down, minDown);
  const totalPay = roundTotalPayUp(rawTotalPay - down, step) + down;
  const monthly = months > 0 ? (totalPay - down) / months : 0;

  return {
    ok: true,
    price,
    hasDown,
    down,
    months,
    rate,
    markupAmount: totalPay - price,
    totalPay,
    monthly,
  };
}

export function buildWhatsAppHref(data: CalcSuccess | null): string {
  if (!data) {
    return (
      "https://wa.me/?text=" +
      encodeURIComponent(
        "Darul Finance — рассрочка\n\n(заполните форму для расчёта)",
      )
    );
  }

  const lines = [
    "Стоимость товара: " + formatMoney(data.price),
    "Первый взнос: " + (data.hasDown ? formatMoney(data.down) : "нет"),
    "Срок: " + data.months + " мес.",
    "Ежемесячный платёж: " + formatMoney(data.monthly),
    "Итоговая стоимость: " + formatMoney(data.totalPay),
  ];

  return "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
}

export type DownHint =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "recommend"; recommended: number };

export function getDownHint(price: number, down: number): DownHint {
  if (!isFinite(price)) {
    return { kind: "empty" };
  }
  const rec = getRecommendedDown(price);
  if (isFinite(down) && down > price) {
    return {
      kind: "error",
      message: "Взнос не может быть больше стоимости товара",
    };
  }
  if (isFinite(down) && !isMultipleOf50Rub(down)) {
    return { kind: "error", message: "Взнос должен быть кратен 50 ₽" };
  }
  return { kind: "recommend", recommended: rec };
}

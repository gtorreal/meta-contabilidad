const CLP_FORMAT = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_FORMAT = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const IPC_NUMBER_FORMAT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const DECIMAL_STRING = /^-?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Parses a decimal string and rounds half-up to an integer as BigInt (no Number precision loss on huge integers).
 */
export function parseDecimalStringToRoundedBigInt(decimalString: string): bigint | null {
  const t = decimalString.trim();
  if (t === "") return null;
  if (!DECIMAL_STRING.test(t)) return null;

  const negative = t.startsWith("-");
  const u = negative ? t.slice(1) : t;
  const dot = u.indexOf(".");
  const intPart = dot === -1 ? u : u.slice(0, dot);
  const fracPart = dot === -1 ? "" : u.slice(dot + 1);

  const intStr =
    intPart === "" ? "0" : (() => {
      const s = intPart.replace(/^0+/, "");
      return s === "" ? "0" : s;
    })();
  const fracDigits = fracPart.replace(/\D/g, "");

  let n = BigInt(intStr);
  if (fracDigits.length > 0 && fracDigits[0]! >= "5") {
    n += 1n;
  }
  if (negative) {
    n = -n;
  }
  return n;
}

const DASH = "—";

export function formatClpInteger(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const n = parseDecimalStringToRoundedBigInt(value);
  if (n === null) return DASH;
  return CLP_FORMAT.format(n);
}

export function formatUsdInteger(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const n = parseDecimalStringToRoundedBigInt(value);
  if (n === null) return DASH;
  return USD_FORMAT.format(n);
}

/** IPC u otros índices: entero redondeado con agrupación es-CL, sin símbolo de moneda. */
export function formatIpcInteger(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const n = parseDecimalStringToRoundedBigInt(value);
  if (n === null) return DASH;
  return IPC_NUMBER_FORMAT.format(n);
}

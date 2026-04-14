export type LeaseScheduleParams = {
  recognitionDate: string;       // YYYY-MM-DD
  firstPaymentDay: number;       // 1–28
  numberOfPeriods: number;
  monthlyInstallmentUF: number;
  annualInterestRate: number;    // e.g. 0.115
  ufAtRecognition: number;
  usefulLifeMonths: number;
};

export type LeaseScheduleRow = {
  period: number;
  paymentDate: string;           // YYYY-MM-DD
  openingBalanceUF: number;
  installmentUF: number;
  interestUF: number;
  amortizationUF: number;
  closingBalanceUF: number;
  installmentCLP: number;
  interestCLP: number;
  monthlyDeprecCLP: number;
  accumDeprecCLP: number;
  netValueCLP: number;
};

/** Payment dates: firstPaymentDay of each month starting the month after recognitionDate. */
export function computePaymentDates(
  recognitionDate: string,
  firstPaymentDay: number,
  numberOfPeriods: number,
): string[] {
  const [y, m] = recognitionDate.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 1; i <= numberOfPeriods; i++) {
    const totalMonth = m + i;
    const year = y + Math.floor((totalMonth - 1) / 12);
    const month = ((totalMonth - 1) % 12) + 1;
    dates.push(
      `${year}-${String(month).padStart(2, "0")}-${String(firstPaymentDay).padStart(2, "0")}`,
    );
  }
  return dates;
}

export function computeScheduleRows(
  params: LeaseScheduleParams,
): LeaseScheduleRow[] {
  const {
    recognitionDate,
    firstPaymentDay,
    numberOfPeriods,
    monthlyInstallmentUF,
    annualInterestRate,
    ufAtRecognition,
    usefulLifeMonths,
  } = params;

  const r = annualInterestRate / 12;

  // Present value of future installments
  const initialPV =
    r === 0
      ? monthlyInstallmentUF * numberOfPeriods
      : (monthlyInstallmentUF * (1 - Math.pow(1 + r, -numberOfPeriods))) / r;

  const initialAssetCLP = initialPV * ufAtRecognition;
  const monthlyDeprecCLP = initialAssetCLP / usefulLifeMonths;

  const paymentDates = computePaymentDates(recognitionDate, firstPaymentDay, numberOfPeriods);

  const rows: LeaseScheduleRow[] = [];
  let balance = initialPV;
  let accumDeprec = 0;

  for (let i = 0; i < numberOfPeriods; i++) {
    const period = i + 1;
    const paymentDate = paymentDates[i]!;
    const openingBalance = balance;

    const interestUF = openingBalance * r;
    const amortizationUF = monthlyInstallmentUF - interestUF;
    const closingBalance = Math.max(0, openingBalance - amortizationUF);

    accumDeprec += monthlyDeprecCLP;
    const netValueCLP = Math.max(0, initialAssetCLP - accumDeprec);

    const installmentCLP = amortizationUF * ufAtRecognition;
    const interestCLP = interestUF * ufAtRecognition;

    rows.push({
      period,
      paymentDate,
      openingBalanceUF: openingBalance,
      installmentUF: monthlyInstallmentUF,
      interestUF,
      amortizationUF,
      closingBalanceUF: closingBalance,
      installmentCLP,
      interestCLP,
      monthlyDeprecCLP,
      accumDeprecCLP: accumDeprec,
      netValueCLP,
    });

    balance = closingBalance;
  }

  return rows;
}

/** Summary values derived from params (for display in the recognition entry card). */
export function computeScheduleSummary(params: LeaseScheduleParams) {
  const r = params.annualInterestRate / 12;
  const initialPV =
    r === 0
      ? params.monthlyInstallmentUF * params.numberOfPeriods
      : (params.monthlyInstallmentUF * (1 - Math.pow(1 + r, -params.numberOfPeriods))) / r;

  const initialAssetCLP = initialPV * params.ufAtRecognition;
  const totalPaymentsCLP =
    params.numberOfPeriods * params.monthlyInstallmentUF * params.ufAtRecognition;
  const deferredInterestCLP = totalPaymentsCLP - initialAssetCLP;
  const totalLiabilityCLP = initialAssetCLP + deferredInterestCLP;

  return {
    initialPV,
    initialAssetCLP,
    deferredInterestCLP,
    totalLiabilityCLP,
    monthlyDeprecCLP: initialAssetCLP / params.usefulLifeMonths,
  };
}

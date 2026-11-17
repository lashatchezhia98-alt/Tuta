import { addDays, dateKey, monthLabel, stamp, validSetup } from "./cycle.mjs";

/** @returns {{status:"invalid"|"overdue", nextPeriod:null, fertility:null} | {status:"estimated", nextPeriod:string, fertility:{ovulation:string,start:string,end:string,passed:boolean}|null}} */
export function calculateCycleEstimate(start, length, duration, today = dateKey()) {
  if (!validSetup(start, length, duration, today))
    return { status: "invalid", nextPeriod: null, fertility: null };
  const nextPeriod = addDays(start, length);
  if (nextPeriod < today)
    return { status: "overdue", nextPeriod: null, fertility: null };
  const ovulation = addDays(nextPeriod, -14);
  const end = addDays(ovulation, 1);
  const fertility = ovulation >= addDays(start, duration)
    ? { ovulation, start: addDays(ovulation, -5), end, passed: end < today }
    : null;
  return { status: "estimated", nextPeriod, fertility };
}

export function formatCalculatorDate(value, ka) {
  const date = new Date(stamp(value));
  // Use an explicit month name, including on browsers without Georgian ICU data.
  const month = monthLabel(new Date(2000, date.getUTCMonth(), 15), ka);
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

export const calculatorMessages = {
  invalid: [
    "შეამოწმე თარიღი და მთელი რიცხვები: ციკლი 21–45, პერიოდი 1–10 დღე.",
    "Check the date and whole numbers: cycle 21–45 days, period 1–10 days.",
  ],
  overdue: [
    "ამ თარიღით გამოთვლილი პერიოდი უკვე გასულია. თუ მას შემდეგ პერიოდი გქონდა, მიუთითე მისი დაწყების თარიღი.",
    "The estimated period for this date has already passed. If you have had a period since then, enter its start date.",
  ],
  unavailable: [
    "ამ მონაცემებით ოვულაციის თარიღს ვერ ვაფასებთ.",
    "An ovulation date cannot be estimated with these inputs.",
  ],
  fertilityPassed: [
    "ამ გამოთვლით სავარაუდო ნაყოფიერი დღეები უკვე გასულია.",
    "The estimated fertile days for this calculation have already passed.",
  ],
};

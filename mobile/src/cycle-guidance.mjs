import { dateKey, history, ordered, stamp, validBirthDate } from './cycle.mjs';

// Reference intervals are educational context, never storage limits or diagnoses.
export const cycleSources = [
  { label: 'FIGO', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10086853/' },
  { label: 'ACOG', url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign' },
];

export function cycleReference(birthDate, today = dateKey()) {
  if (typeof birthDate !== 'string' || !validBirthDate(birthDate, today)) return { kind: 'unknown', min: null, max: null };
  const age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4)) - Number(today.slice(5) < birthDate.slice(5));
  if (age >= 18 && age <= 45) return { kind: 'adult', min: 24, max: 38 };
  if (age >= 10 && age < 18) return { kind: 'adolescent', min: 21, max: 45 };
  return { kind: 'other', min: null, max: null };
}

export function cycleEducation(periods, birthDate, lang = 'ka', today = dateKey()) {
  stamp(today);
  const ka = lang === 'ka';
  const reference = cycleReference(birthDate, today);
  const lengths = history(ordered(periods).filter(p => p.start <= today)).map(p => p.length);
  const context = reference.kind === 'adult'
    ? (ka ? '18–45 წლისთვის FIGO-ს საცნობარო დიაპაზონია 24–38 დღე.' : 'For ages 18–45, FIGO uses a reference interval of 24–38 days.')
    : reference.kind === 'adolescent'
      ? (ka ? 'მოზარდებში, განსაკუთრებით პირველი მენსტრუაციის შემდეგ საწყის წლებში, ACOG-ის საცნობარო დიაპაზონია 21–45 დღე.' : 'For adolescents, particularly in the early years after the first period, ACOG describes a reference interval of 21–45 days.')
      : reference.kind === 'other'
        ? (ka ? 'ასაკისა და ცხოვრების ეტაპის მიხედვით ციკლის შეფასება განსხვავდება. ზრდასრულთა დიაპაზონს შენს შემთხვევაში ავტომატურად არ ვიყენებთ.' : 'Cycle interpretation varies with age and life stage. We do not automatically apply the adult interval here.')
        : (ka ? 'საცნობარო დიაპაზონები: 18–45 წლისთვის FIGO — 24–38 დღე; მოზარდებისთვის ACOG — 21–45 დღე. ასაკობრივი კონტექსტი ამ ანგარიშისთვის უცნობია.' : 'Reference intervals: FIGO, ages 18–45 — 24–38 days; ACOG, adolescents — 21–45 days. Age context is unavailable for this account.');
  return {
    heading: ka ? 'შენი ციკლი და საცნობარო დიაპაზონები' : 'Your cycle and reference intervals',
    paragraphs: [
      ka ? '28 დღე მხოლოდ საწყისი ვარაუდია. საწყისი პარამეტრი შეგიძლია შეცვალო 21–45 დღის ფარგლებში; ეს შესაყვანი ველის ზღვარია და არა ყველასთვის ნორმის განსაზღვრება.' : '28 days is only the starting assumption. You can set an initial length from 21–45 days; this is a setting limit, not a definition of normal for everyone.',
      context,
      ka ? 'პირადი საშუალო გამოითვლება მინიმუმ 3 დასრულებული ციკლით — ამისთვის საჭიროა 4 დაწყების თარიღი. უფრო მოკლე და გრძელი რეალური ციკლებიც ინახება; მათი სიგრძე 21–45 დღემდე არ იცვლება.' : 'A personal average needs at least 3 completed cycles — 4 start dates. Shorter and longer observed cycles are kept as recorded, not clamped to 21–45 days.',
      ka ? 'ერთი განსხვავებული ციკლი დიაგნოზი არ არის. თუ ცვლილება მეორდება ან გაწუხებს, განიხილე ექიმთან. ორსულობა, ჰორმონული კონტრაცეფცია და სხვა ცხოვრებისეული გარემოებები ცალკე შეფასებას საჭიროებს.' : 'One different cycle is not a diagnosis. Discuss recurring or concerning changes with a clinician. Pregnancy, hormonal contraception and other life circumstances require separate consideration.',
    ],
    summary: lengths.length ? (ka
      ? `შენი ${lengths.length} დასრულებული ციკლი: უმოკლესი ${Math.min(...lengths)} დღე; უგრძესი ${Math.max(...lengths)} დღე; სხვაობა ${Math.max(...lengths) - Math.min(...lengths)} დღე.`
      : `Your ${lengths.length} completed cycles: shortest ${Math.min(...lengths)} days; longest ${Math.max(...lengths)} days; difference ${Math.max(...lengths) - Math.min(...lengths)} days.`) : (ka ? 'საკუთარი დიაპაზონის სანახავად დაამატე წინა პერიოდების დაწყების თარიღები.' : 'Add previous period start dates to see your observed range.'),
  };
}

export function trackingJourney(data, lang = 'ka', today = dateKey()) {
  stamp(today);
  const ka = lang === 'ka';
  const periods = ordered(data.periods).filter(p => p.start <= today);
  const completed = Math.max(0, periods.length - 1);
  const logged = data.logs.some(log => log.date === today);
  return [
    { id: 'period', done: periods.length > 0, action: 'period', title: ka ? 'ჩაიწერე პერიოდის დაწყება' : 'Record a period start', detail: ka ? 'მონიშნე რეალური დაწყების თარიღი და მხოლოდ უკვე გასული სისხლდენის დღეები.' : 'Use the actual start date and only bleeding days that have already happened.' },
    { id: 'history', done: completed >= 3, action: 'period', title: ka ? 'შეაგროვე პირადი ისტორია' : 'Build your own history', detail: ka ? `${completed}/3 დასრულებული ციკლი. პირადი საშუალოსთვის საჭიროა 4 დაწყების თარიღი; გამოტოვებული თარიღები არ გამოიგონო.` : `${completed}/3 completed cycles. A personal average needs 4 start dates; do not invent missing dates.` },
    { id: 'journal', done: logged, action: 'log', title: ka ? 'შეავსე დღევანდელი დღიური' : 'Complete today’s check-in', detail: ka ? 'აღრიცხე განწყობა, ენერგია და სიმპტომები. ეს ნაბიჯი ყოველ ახალ დღეს თავიდან გამოჩნდება.' : 'Record mood, energy and symptoms. This step resets each day.' },
    { id: 'insights', done: false, action: 'insights', title: ka ? 'გადახედე შენს ანალიზს' : 'Review your insights', detail: ka ? 'ნახე ჩანაწერების შეჯამება და განმეორებადი ნიშნები. ეს არ არის მკურნალობის პროგრამა ან დიაგნოზი.' : 'Explore summaries and recurring observations. This is not a treatment program or diagnosis.' },
  ];
}

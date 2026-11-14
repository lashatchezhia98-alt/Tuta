export const reviewItems = [
  ["longCycles", "ციკლები ხშირად 35 დღეზე მეტია", "Cycles often last more than 35 days"],
  ["acne", "აკნე", "Acne"],
  ["hairLoss", "თმის შესამჩნევი შეთხელება", "Noticeable hair thinning"],
  ["weightGain", "წონის მატება", "Weight gain"],
  ["severeCramps", "ძლიერი მენსტრუალური ტკივილი (4 ან 5 ქულა 5-დან)", "Severe period pain (4 or 5 out of 5)"],
  ["painDuringSex", "ტკივილი სქესობრივი აქტის დროს", "Pain during sex"],
  ["heavyFlow", "უხვი სისხლდენა", "Heavy bleeding"],
];

export function reviewSymptoms(selected) {
  const keys = new Set(selected);
  const count = (group) => group.filter((id) => keys.has(id)).length;
  const pcos = count(["longCycles", "acne", "hairLoss", "weightGain"]);
  const endometriosis = count(["severeCramps", "painDuringSex", "heavyFlow"]);
  return {
    pcos: pcos >= 3,
    endometriosis: endometriosis >= 3,
    discuss: pcos >= 3 || endometriosis >= 3 || endometriosis > 0,
  };
}

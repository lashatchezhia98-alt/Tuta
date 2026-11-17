export const libraryCategories = {
  cycle: ["პერიოდი", "Period"],
  pregnancy: ["ორსულობა", "Pregnancy"],
  nutrition: ["კვება", "Nutrition"],
  "mental-health": ["ემოციური ჯანმრთელობა", "Mental wellbeing"],
} satisfies Record<string, [string, string]>;

type SearchableArticle = {
  category: string;
  title_ka: string;
  title_en: string;
  body_ka: string;
  body_en: string;
};

export function filterLibrary<T extends SearchableArticle>(articles: readonly T[], category: string, search: string): T[] {
  const query = search.trim().normalize("NFC").toLowerCase();
  return articles.filter(article =>
    (!category || article.category === category) &&
    (!query || [article.title_ka, article.title_en, article.body_ka, article.body_en].some(value =>
      (value ?? "").normalize("NFC").toLowerCase().includes(query))),
  );
}

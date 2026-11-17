import { Check, Minus } from "lucide-react";
import { SiteCopyText } from "@/components/site-copy-provider";
import type { CopyLanguage } from "@/lib/site-copy";
import styles from "./premium-comparison.module.css";
import { premiumComparisonFeatures } from "@/lib/premium-comparison";

function Availability({ included, lang }: { included: boolean; lang: CopyLanguage }) {
  return (
    <span className={included ? styles.included : styles.excluded}>
      {included ? <Check size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
      <span className="sr-only">
        {included
          ? lang === "ka" ? "შედის გეგმაში" : "Included"
          : lang === "ka" ? "არ შედის გეგმაში" : "Not included"}
      </span>
    </span>
  );
}

export default function PremiumComparison({ lang }: { lang: CopyLanguage }) {
  return (
    <section className={`inner-container ${styles.section}`} aria-labelledby="premium-comparison-title">
      <h2 id="premium-comparison-title"><SiteCopyText id="premium.compare.title" lang={lang} /></h2>
      <p><SiteCopyText id="premium.compare.intro" lang={lang} /></p>
      <div className={styles.frame}>
        <table className={styles.table} aria-labelledby="premium-comparison-title">
          <colgroup><col /><col className={styles.plan} /><col className={styles.plan} /></colgroup>
          <thead>
            <tr>
              <th scope="col"><SiteCopyText id="premium.compare.feature" lang={lang} /></th>
              <th scope="col"><SiteCopyText id="premium.compare.free" lang={lang} /></th>
              <th scope="col"><SiteCopyText id="premium.compare.paid" lang={lang} /></th>
            </tr>
          </thead>
          <tbody>
            {premiumComparisonFeatures.map(({ id, free }) => (
              <tr key={id}>
                <th scope="row"><SiteCopyText id={`premium.compare.${id}`} lang={lang} /></th>
                <td><Availability included={free} lang={lang} /></td>
                <td><Availability included lang={lang} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}><SiteCopyText id="premium.compare.note" lang={lang} /></p>
    </section>
  );
}

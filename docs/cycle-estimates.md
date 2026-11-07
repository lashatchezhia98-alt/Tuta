# Cycle estimates and guidance

- Initial cycle length defaults to 28 days; the editable setting is 21–45 days.
- This setting range is not a clinical definition of normal. Recorded start dates
  can produce shorter or longer intervals; no interval is clamped or discarded.
- Three completed cycles require four start dates. Until then the selected initial
  length is used; afterwards the arithmetic mean of completed intervals is used.
- Close starts are not blocked by a fixed minimum gap. Only overlapping recorded
  bleeding days are rejected by the web and mobile editors.
- A 7-day deviation flag is a product observation, not a clinical diagnosis.
  Date estimates are also marked uncertain when the observed range exceeds 7 days,
  or the average falls outside the calculation model's 21–45-day window.
- Fertility estimates are hidden with insufficient/variable data or outside that
  model window. Unusual records remain accessible. Hormonal phases are unknown
  outside that window; observed bleeding is still shown.
- The shortest/longest historical intervals are observations, not confidence bounds.
- Date arithmetic is timezone-independent. Estimates do not confirm ovulation and
  must not be used as contraception.

## Educational reference intervals

- FIGO: 24–38 days for ages 18–45:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10086853/
- ACOG: 21–45 days in adolescents, especially early after menarche:
  https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign

Account birth date selects educational context only, never authorization or a
diagnosis. Unknown, invalid, younger-child or over-45 ages do not inherit an adult
interval. Pregnancy, contraception and other life-stage contexts are not inferred
from age. This is informational guidance, not a validated medical device.

## Guided journey

Web `/app/journey` and the mobile menu use the same entry-derived checklist. It
shows period setup, progress toward three completed cycles, today's check-in and
an insights link. Check-in completion resets each date. Review completion is not
fabricated. This is onboarding, not a medical or treatment program. The web admin
can control its visibility using the existing `journey` feature setting.
The mobile menu checks that same public setting and fails closed when unavailable.

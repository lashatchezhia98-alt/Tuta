# Cycle estimates, version 1.0.1

## Scope and comparison

This is Tuta's deterministic, on-device calendar model. It is not Flo's proprietary model and has not been clinically calibrated or validated. Passing software tests proves date arithmetic and consistent behavior, not biological prediction accuracy.

Flo publicly describes use of logged history, wider fertile windows when cycle variability increases, and hidden future predictions during a displayed delay:

- https://flo.health/flo-accuracy
- https://help.flo.health/hc/en-us/articles/360015106672-Why-can-t-I-see-ovulation-predictions
- https://help.flo.health/hc/en-us/articles/360015313531-Why-is-my-fertile-window-so-short-long

Flo also describes using the last 12 logged cycles. Tuta retains the original project rule: arithmetic mean of all completed recorded cycles after at least 3 completed cycles. Three completed intervals need four start dates. Before that, the user's supplied average is used and labeled as an initial estimate.

## Behavior

- Completed cycle lengths are differences between actual period start dates, not user-entered guesses or generated predictions.
- Only start dates on or before the evaluation day count toward the current model. Historical phase calculations use only records available at that cycle's start.
- Next period = most recent actual start + rounded mean length. Each of the next six estimates uses that same rounded length, so list and calendar cannot drift apart.
- Estimated ovulation = next period minus 14 days; estimated fertile window = ovulation minus 5 through plus 1, preserving the requested baseline formula.
- Future estimates stop when the expected start date has passed without a new logged start. Recording an actual new period restarts predictions. Missed expected starts are never converted into actual cycles.
- An observed historical date range uses the shortest and longest recorded completed cycle. It is not a probability interval and does not guarantee that the next period will fall inside it.
- Variation greater than 7 days from the mean flags irregularity. A historical range over 7 days also lowers the model's qualitative reliability.
- Fertile-day highlights are withheld before 3 completed cycles, with highly variable data, outside the configured 21–45-day estimate domain, during delay, or when the estimated ovulation date overlaps bleeding duration. No BBT, LH-test or measured ovulation input is supported yet.
- Recorded period days and future period estimates have different calendar states. Fertility is never treated as a confirmed past biological event.

## Verification

`npm test` runs 14 tests, including a sweep through every stable length from 21 to 45 days, irregular histories, fractional averages, delayed and resumed cycles, invalid / duplicate / future dates, unsorted history, leap days and date arithmetic independent of local daylight-saving changes.

The code does not infer pregnancy, PCOS or endometriosis from a delayed or irregular cycle.

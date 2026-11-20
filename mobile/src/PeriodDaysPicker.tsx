import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "./Art";
import { calendarColors, dateKey, monthLabel, periodCalendarLegend, periodCalendarModel, periodDayLabel } from "./cycle.mjs";
import { C, T, s } from "./ui";

type Calendar = ReturnType<typeof periodCalendarModel>;

export function CalendarKeyMark({ kind, symbol }: { kind: string; symbol?: string }) {
  return <View style={marks.key} accessible={false}>
    {kind === "period" ? <View style={marks.periodSample} />
      : kind === "predicted" ? <View style={marks.predictedSample} />
      : kind === "fertile" ? <View style={marks.fertileSample} />
      : kind === "today" ? <View style={marks.todaySample} />
      : <T style={{ fontSize: 12, lineHeight: 16 }}>{symbol}</T>}
  </View>;
}

export function PeriodDaysPicker({ ka, calendar, month, setMonth, selected, days, onPressDay, busy }: {
  ka: boolean;
  calendar: Calendar;
  month: Date;
  setMonth: (month: Date) => void;
  selected: string | null;
  days?: string[];
  onPressDay: (day: string) => void;
  busy: boolean;
}) {
  const year = month.getFullYear();
  const index = month.getMonth();
  const count = new Date(year, index + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const weekdays = ka ? ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const forwardDisabled = busy || (!!days && dateKey(month).slice(0, 7) >= calendar.today.slice(0, 7));
  const chosen = new Set(days);
  const legend = periodCalendarLegend(ka, !!days);
  return <>
    <View style={s.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel={ka ? "წინა თვე" : "Previous month"}
        disabled={busy} accessibilityState={{ disabled: busy }} style={[s.round, busy && marks.disabled]}
        onPress={() => setMonth(new Date(year, index - 1, 1))}><Icon name="back" /></Pressable>
      <T accessibilityLiveRegion="polite" weight="bold" style={{ flex: 1, textAlign: "center" }}>{monthLabel(month, ka)} {year}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={ka ? "შემდეგი თვე" : "Next month"}
        disabled={forwardDisabled} accessibilityState={{ disabled: forwardDisabled }} style={[s.round, forwardDisabled && marks.disabled]}
        onPress={() => setMonth(new Date(year, index + 1, 1))}><Icon name="arrow" /></Pressable>
    </View>
    <View style={{ flexDirection: "row" }}>
      {weekdays.map(day => <View key={day} style={[s.cell, { alignItems: "center", paddingVertical: 8 }]}>
        <T style={{ fontSize: 10 }}>{day}</T>
      </View>)}
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, cell) => {
        const number = cell - offset + 1;
        if (number < 1 || number > count) return <View key={cell} style={s.cell} />;
        const date = dateKey(new Date(year, index, number));
        const day = calendar.day(date);
        const marked = chosen.has(date);
        const active = days ? marked : selected === date;
        const disabled = busy || (!!days && date > calendar.today);
        const symbols = legend.filter(item => item.symbol && (item.key === "draft" ? marked : day[item.key as keyof typeof day] === true));
        return <View key={date} style={s.cell}>
          <Pressable accessibilityRole="button" accessibilityLabel={periodDayLabel(day, date, ka, marked)}
            accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={() => onPressDay(date)}
            style={[s.day, marks.cell, day.state === "period" && marks.recorded, day.state === "predicted" && marks.predicted, disabled && marks.disabled]}>
            {active && <View pointerEvents="none" style={marks.active} />}
            <View style={[marks.date, day.today && marks.today]}>
              <T weight={day.today || marked ? "bold" : "regular"} style={{ fontSize: 13, lineHeight: 18 }}>{number}</T>
            </View>
            {symbols.length > 0 && <View style={marks.symbols} pointerEvents="none">
              {symbols.map(({ key, symbol }) => <T key={key} allowFontScaling={false} style={[marks.symbol, key === "draft" && { color: "#45236E" }]}>{symbol}</T>)}
            </View>}
            {day.state === "fertile" && <View style={marks.fertile} pointerEvents="none" />}
          </Pressable>
        </View>;
      })}
    </View>
    <T weight="bold" style={{ marginVertical: 8 }}>{ka ? "კალენდრის ნიშნები" : "Calendar key"}</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {legend.map(({ key, symbol, label }) => <View key={key} style={[s.row, { gap: 4, flexBasis: "47%", flexGrow: 1 }]}>
        <CalendarKeyMark kind={key} symbol={symbol}/><T style={{ flexShrink: 1, fontSize: 11 }}>{label}</T>
      </View>)}
    </View>
  </>;
}

const marks = StyleSheet.create({
  disabled: { opacity: 0.45 },
  cell: { minHeight: 50, paddingBottom: 10, backgroundColor: "#F7F5FA", borderWidth: 2 },
  recorded: { backgroundColor: calendarColors.period },
  predicted: { backgroundColor: C.white, borderColor: calendarColors.predicted, borderStyle: "dashed" },
  active: { position: "absolute", top: 1, bottom: 1, right: 1, left: 1, borderWidth: 1, borderColor: "#725A90", borderRadius: 7 },
  date: { minWidth: 23, minHeight: 23, alignItems: "center", justifyContent: "center", paddingHorizontal: 1, borderWidth: 1.5, borderColor: "transparent", borderRadius: 20 },
  today: { borderColor: C.ink },
  fertile: { position: "absolute", left: "14%", right: "14%", height: 3, bottom: 2, backgroundColor: calendarColors.fertile, borderRadius: 5 },
  symbols: { position: "absolute", bottom: 6, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 1 },
  symbol: { fontSize: 9, lineHeight: 11 },
  key: { width: 16, height: 16, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  periodSample: { width: 14, height: 14, borderColor: calendarColors.predicted, borderWidth: 1, backgroundColor: calendarColors.period, borderRadius: 4 },
  predictedSample: { width: 14, height: 14, borderColor: calendarColors.predicted, borderWidth: 2, borderStyle: "dashed", borderRadius: 4 },
  fertileSample: { width: 15, height: 3, backgroundColor: calendarColors.fertile, borderRadius: 5 },
  todaySample: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: C.ink },
});

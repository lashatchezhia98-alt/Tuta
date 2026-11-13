import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "./Art";
import { dateKey, monthLabel } from "./cycle.mjs";
import { C, T, s } from "./ui";

export function PeriodDaysPicker({
  ka,
  initialDate,
  days,
  onToggle,
}: {
  ka: boolean;
  initialDate: string;
  days: string[];
  onToggle: (date: string) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(Number(initialDate.slice(0, 4)), Number(initialDate.slice(5, 7)) - 1, 1),
  );
  const year = month.getFullYear();
  const index = month.getMonth();
  const today = dateKey();
  const count = new Date(year, index + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const weekdays = ka ? ["ორ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const atCurrentMonth = dateKey(month).slice(0, 7) >= today.slice(0, 7);
  const chosen = new Set(days);

  return (
    <View style={[s.card, { paddingHorizontal: 6 }]}>
      <View style={s.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel={ka ? "წინა თვე" : "Previous month"} style={s.round} onPress={() => setMonth(new Date(year, index - 1, 1))}>
          <Icon name="back" />
        </Pressable>
        <T weight="bold" style={{ flex: 1, textAlign: "center" }}>{monthLabel(month, ka)} {year}</T>
        <Pressable accessibilityRole="button" accessibilityLabel={ka ? "შემდეგი თვე" : "Next month"} accessibilityState={{ disabled: atCurrentMonth }} disabled={atCurrentMonth} style={[s.round, atCurrentMonth && { opacity: 0.4 }]} onPress={() => setMonth(new Date(year, index + 1, 1))}>
          <Icon name="arrow" />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {weekdays.map((day) => (
          <View key={day} style={[s.cell, { alignItems: "center", paddingVertical: 8 }]}>
            <T style={{ fontSize: 11 }}>{day}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, cell) => {
          const day = cell - offset + 1;
          if (day < 1 || day > count) return <View key={`empty-${cell}`} style={s.cell} />;
          const date = dateKey(new Date(year, index, day));
          const marked = chosen.has(date);
          const disabled = date > today;
          return (
            <View key={date} style={s.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={date}
                accessibilityState={{ selected: marked, disabled }}
                disabled={disabled}
                onPress={() => onToggle(date)}
                style={[s.day, { backgroundColor: marked ? C.lav : C.white, borderColor: marked ? C.ink : C.line, borderWidth: marked ? 1.5 : 1, opacity: disabled ? 0.4 : 1 }]}
              >
                <T weight={marked ? "bold" : "regular"}>{day}</T>
              </Pressable>
            </View>
          );
        })}
      </View>
      <T accessibilityLiveRegion="polite" style={[s.muted, { marginTop: 10, textAlign: "center" }]}>
        {ka ? `მონიშნულია ${days.length} დღე` : `${days.length} selected`}
      </T>
    </View>
  );
}

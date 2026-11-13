import React from "react";
import { Platform } from "react-native";
import Svg, { Path, Circle, Ellipse, G } from "react-native-svg";
export function MoonFlower({ size = 240 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 260 280"
      accessible={Platform.OS === "web" ? undefined : false}
    >
      <Path
        d="M174 12C58 3 10 153 101 211c55 35 121 14 145-42-94 61-170-78-72-157Z"
        fill="#FDF0CC"
      />
      <Path
        d="M146 268c-42-72-36-115 0-191M127 173l-30-47M123 196l54-45"
        stroke="#51445F"
        strokeWidth="3"
        fill="none"
      />
      <Path
        d="M118 165c-44-3-52-29-52-42 35-1 48 17 52 42M130 189c10-35 29-43 55-42-10 28-31 42-55 42"
        fill="#655475"
      />
      <G transform="translate(148 83)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <Ellipse
            key={a}
            cx="0"
            cy="-14"
            rx="10"
            ry="20"
            fill={a % 120 === 0 ? "#B7A0D8" : "#CAB6E7"}
            transform={`rotate(${a})`}
          />
        ))}
        <Circle r="10" fill="#9278B2" />
      </G>
      <Path
        d="M209 18q0 18-15 21 15 4 15 22 2-18 16-22-14-3-16-21M237 81q0 10-9 12 9 2 9 13 2-11 10-13-8-2-10-12M59 40q0 9-7 11 7 2 7 11 2-9 8-11-6-2-8-11"
        fill="#FDF0CC"
      />
    </Svg>
  );
}
export function CycleOrbit({
  day,
  length,
  size = 156,
}: {
  day: number;
  length: number;
  size?: number;
}) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, day / Math.max(1, length)));
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 156 156"
      accessible={Platform.OS === "web" ? undefined : false}
    >
      <Circle
        cx="78"
        cy="78"
        r={radius}
        stroke="#D8C9EA"
        strokeWidth="11"
        fill="none"
      />
      <Circle
        cx="78"
        cy="78"
        r={radius}
        stroke="#1E1B2E"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - progress)}
        rotation="-90"
        origin="78, 78"
      />
      <Circle cx="78" cy="78" r="48" fill="#F9F8FC" />
      <Path d="M93 44a28 28 0 1 0 21 49A30 30 0 0 1 93 44Z" fill="#FDF0CC" />
      <Circle cx="111" cy="49" r="3" fill="#B7A0D8" />
    </Svg>
  );
}
export function Icon({
  name,
  size = 24,
  color = "#1E1B2E",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const extra: Record<string, string> = {
    market: "M3 4h18l-2 6H5ZM5 10v11h14V10M9 21v-7h6v7",
    services: "M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z",
    care: "M5 3v5a5 5 0 0 0 10 0V3M5 5H3m12 0h2M10 13v3a5 5 0 0 0 10 0v-3m2-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    book: "M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2ZM12 6v15",
    report: "M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5",
  };
  const paths: Record<string, string> = {
    home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    cycle: "M20 7a9 9 0 1 0 1 7M20 2v5h-5",
    calendar: "M4 5h16v16H4ZM4 10h16M8 2v6m8-6v6",
    log: "M12 5v14M5 12h14",
    insights: "M5 20V12m7 8V4m7 16V8",
    profile: "M4 21v-3c0-6 16-6 16 0v3M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    arrow: "m9 5 7 7-7 7",
    back: "m15 5-7 7 7 7",
    spark: "m12 2 3 7 7 3-7 3-3 7-7-3 7-3Z",
    communityStars: "M11 5l1.8 4.2L17 11l-4.2 1.8L11 17l-1.8-4.2L5 11l4.2-1.8L11 5ZM4 1l.9 2.1L7 4l-2.1.9L4 7l-.9-2.1L1 4l2.1-.9L4 1ZM19 1l1.1 2.9L23 5l-2.9 1.1L19 9l-1.1-2.9L15 5l2.9-1.1L19 1ZM4 14l1 2.5L7.5 17.5l-2.5 1L4 21l-1-2.5-2.5-1 2.5-1L4 14ZM19 13l1.2 3.3L23.5 17.5l-3.3 1.2L19 22l-1.2-3.3-3.3-1.2 3.3-1.2L19 13ZM11 18l.7 1.8 1.8.7-1.8.7L11 23l-.7-1.8-1.8-.7 1.8-.7L11 18Z",
    lock: "M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4",
    check: "m5 12 4 4 10-10",
    moon: "M19 16A9 9 0 0 1 8 3a9 9 0 1 0 11 13",
    menu: "M4 6h16M4 12h16M4 18h16",
    image: "M3 4h18v16H3ZM6 16l4-4 3 3 3-4 4 6M8 8h.01",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    close: "M5 5l14 14M19 5 5 19",
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={Platform.OS === "web" ? undefined : false}
    >
      <Path
        d={extra[name] || paths[name] || paths.spark}
        stroke={name === "communityStars" ? "none" : color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={name === "communityStars" ? color : "none"}
      />
    </Svg>
  );
}
export function Face({ mood, size = 52 }: { mood: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      accessible={Platform.OS === "web" ? undefined : false}
    >
      <Circle
        cx="30"
        cy="30"
        r="28"
        fill={
          mood === "happy" ? "#FDF0CC" : mood === "low" ? "#D8E0ED" : "#E3D8F1"
        }
      />
      {mood === "calm" || mood === "tired" ? (
        <Path
          d="M15 24q5 7 10 0m10 0q5 7 10 0"
          fill="none"
          stroke="#1E1B2E"
          strokeWidth="2"
        />
      ) : (
        <>
          <Circle cx="21" cy="25" r="2.5" fill="#1E1B2E" />
          <Circle cx="39" cy="25" r="2.5" fill="#1E1B2E" />
        </>
      )}
      <Path
        d={
          mood === "happy"
            ? "M21 36q9 13 18 0"
            : mood === "low"
              ? "M22 42q8-12 16 0"
              : mood === "tense"
                ? "m21 39 4-3 5 3 5-3 4 3"
                : "M24 39q6 5 12 0"
        }
        stroke="#1E1B2E"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

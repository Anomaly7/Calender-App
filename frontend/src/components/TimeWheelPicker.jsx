import { useEffect, useRef } from "react";

const ROW_HEIGHT = 32;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const MERIDIEMS = ["AM", "PM"];

function parseValue(value) {
  if (!value) return { hour12: 9, minute: 0, meridiem: "AM" };

  const [h, m] = value.split(":").map(Number);
  const meridiem = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;

  // Snap to the nearest 5-minute wheel position.
  const nearestMinute = Math.round(m / 5) * 5 % 60;

  return { hour12, minute: nearestMinute, meridiem };
}

function toValue(hour12, minute, meridiem) {
  let h = hour12 % 12;
  if (meridiem === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function Wheel({ items, index, onSelect, formatItem }) {
  const ref = useRef(null);
  const scrollTimeout = useRef(null);
  const suppressScroll = useRef(false);

  // Position the wheel at its initial value on mount only - after that,
  // every position change is driven by the user's own scroll/click here.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = index * ROW_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function settleOn(i) {
    const el = ref.current;
    if (!el) return;
    suppressScroll.current = true;
    el.scrollTo({ top: i * ROW_HEIGHT, behavior: "smooth" });
    onSelect(i);
    setTimeout(() => { suppressScroll.current = false; }, 250);
  }

  function handleScroll() {
    if (suppressScroll.current) return;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    scrollTimeout.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const raw = Math.round(el.scrollTop / ROW_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, raw));
      settleOn(clamped);
    }, 120);
  }

  return (
    <div className="wheel-col" ref={ref} onScroll={handleScroll}>
      <div className="wheel-pad" />
      {items.map((item, i) => (
        <div
          key={item}
          className={`wheel-item ${i === index ? "selected" : ""}`}
          onClick={() => settleOn(i)}
        >
          {formatItem ? formatItem(item) : item}
        </div>
      ))}
      <div className="wheel-pad" />
    </div>
  );
}

export default function TimeWheelPicker({ value, onChange }) {
  const { hour12, minute, meridiem } = parseValue(value);

  const hourIndex = HOURS.indexOf(hour12);
  const minuteIndex = MINUTES.indexOf(minute);
  const meridiemIndex = MERIDIEMS.indexOf(meridiem);

  function update(newHour12, newMinute, newMeridiem) {
    onChange(toValue(newHour12, newMinute, newMeridiem));
  }

  return (
    <div className="wheel-picker">
      <div className="wheel-selection-frame" />
      <Wheel
        items={HOURS}
        index={hourIndex}
        onSelect={(i) => update(HOURS[i], minute, meridiem)}
      />
      <Wheel
        items={MINUTES}
        index={minuteIndex}
        formatItem={(m) => String(m).padStart(2, "0")}
        onSelect={(i) => update(hour12, MINUTES[i], meridiem)}
      />
      <Wheel
        items={MERIDIEMS}
        index={meridiemIndex}
        onSelect={(i) => update(hour12, minute, MERIDIEMS[i])}
      />
    </div>
  );
}

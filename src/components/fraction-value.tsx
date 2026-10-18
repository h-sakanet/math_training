import type { Fraction } from "@/lib/fractions";

export function FractionValue({ value }: { value: Fraction }) {
  return (
    <span className="fraction-value" aria-label={value.denominator === 1
      ? String(value.numerator) : `${value.denominator}分の${value.numerator}`}>
      <span>{value.numerator}</span>
      {value.denominator !== 1 && <span className="fraction-denominator">{value.denominator}</span>}
    </span>
  );
}

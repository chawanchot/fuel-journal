import type { Fillup } from "../types";
import { number, parseFillup } from "./validation";

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

export function sortFillups(fillups: readonly Fillup[]): Fillup[] {
  return [...fillups].sort(
    (a, b) =>
      compareText(a.date, b.date) ||
      a.odometerKm - b.odometerKm ||
      compareText(a.createdAt, b.createdAt) ||
      compareText(a.id, b.id),
  );
}

export function validateFillup(
  fillup: Fillup,
  existing: readonly Fillup[],
): string | null {
  try {
    parseFillup(fillup);
    const ordered = sortFillups([
      ...existing.filter(
        (f) => f.vehicleId === fillup.vehicleId && f.id !== fillup.id,
      ),
      fillup,
    ]);
    const index = ordered.indexOf(fillup);
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    if (previous && previous.odometerKm > fillup.odometerKm)
      return "เลขไมล์ต้องไม่น้อยกว่าการเติมน้ำมันครั้งก่อน";
    if (next && next.odometerKm < fillup.odometerKm)
      return "เลขไมล์ต้องไม่มากกว่าการเติมน้ำมันครั้งถัดไป";
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "ข้อมูลการเติมน้ำมันไม่ถูกต้อง";
  }
}

export function calculateStats(fillups: readonly Fillup[]): {
  distanceKm: number;
  litres: number;
  amountSatang: number;
  efficiency: number | null;
  costPerKm: number | null;
  cycles: number;
} {
  let distanceKm = 0;
  let millilitres = 0;
  let amountSatang = 0;
  let cycles = 0;
  const vehicles = new Map<
    string,
    {
      previous: number;
      baseline: number | null;
      volume: number;
      amount: number;
    }
  >();
  const ids = new Set<string>();
  for (const fillup of sortFillups(fillups)) {
    parseFillup(fillup);
    if (ids.has(fillup.id)) throw new Error("Duplicate fillup id");
    ids.add(fillup.id);
    let state = vehicles.get(fillup.vehicleId);
    if (!state) {
      state = {
        previous: fillup.odometerKm,
        baseline: null,
        volume: 0,
        amount: 0,
      };
      vehicles.set(fillup.vehicleId, state);
    }
    if (fillup.odometerKm < state.previous)
      throw new Error("Odometer decreases between fillups");
    state.previous = fillup.odometerKm;
    if (fillup.missedFillupBefore) {
      state.baseline = null;
      state.volume = 0;
      state.amount = 0;
    }
    if (state.baseline !== null) {
      state.volume += fillup.volumeMillilitres;
      state.amount += fillup.amountSatang;
      if (fillup.fullTank && fillup.odometerKm > state.baseline) {
        distanceKm += fillup.odometerKm - state.baseline;
        millilitres += state.volume;
        amountSatang += state.amount;
        cycles++;
      }
    }
    if (fillup.fullTank) {
      state.baseline = fillup.odometerKm;
      state.volume = 0;
      state.amount = 0;
    }
  }
  const litres = millilitres / 1000;
  const efficiency = litres > 0 ? distanceKm / litres : null;
  // Monetary inputs use satang; user-facing costs use baht.
  const costPerKm = distanceKm > 0 ? amountSatang / 100 / distanceKm : null;
  for (const value of [
    distanceKm,
    litres,
    amountSatang,
    efficiency,
    costPerKm,
  ]) {
    if (value !== null && !Number.isFinite(value))
      throw new Error("Statistics overflow");
  }
  if (!Number.isSafeInteger(millilitres) || !Number.isSafeInteger(amountSatang))
    throw new Error("Statistics exceed safe integer precision");
  return { distanceKm, litres, amountSatang, efficiency, costPerKm, cycles };
}

function finiteResult(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Calculation overflow");
  return value;
}

// Price, extras, and returned costs use the same currency unit (normally baht).
export function calculateTrip(
  distance: number,
  efficiency: number,
  price: number,
  roundTrip: boolean,
  extras: number,
  people: number,
): {
  distance: number;
  litres: number;
  fuelCost: number;
  total: number;
  perPerson: number;
} {
  number(distance, "Distance");
  number(efficiency, "Efficiency", true);
  number(price, "Price", true);
  number(extras, "Extras");
  number(people, "People", true, true);
  if (typeof roundTrip !== "boolean")
    throw new Error("Round trip must be a boolean");
  const tripDistance = finiteResult(distance * (roundTrip ? 2 : 1));
  const litres = finiteResult(tripDistance / efficiency);
  const fuelCost = finiteResult(litres * price);
  const total = finiteResult(fuelCost + extras);
  return {
    distance: tripDistance,
    litres,
    fuelCost,
    total,
    perPerson: finiteResult(total / people),
  };
}

export function calculateConsumption(
  distance: number,
  litres: number,
): { efficiency: number; litresPer100: number } {
  number(distance, "Distance", true);
  number(litres, "Litres", true);
  return {
    efficiency: finiteResult(distance / litres),
    litresPer100: finiteResult((litres / distance) * 100),
  };
}

export function calculateRange(litres: number, efficiency: number): number {
  number(litres, "Litres");
  number(efficiency, "Efficiency", true);
  return finiteResult(litres * efficiency);
}

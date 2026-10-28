export interface Vehicle {
  id: string;
  name: string;
  type: "car" | "motorcycle";
  fuelType: string;
  manualEfficiency?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Fillup {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  amountSatang: number;
  volumeMillilitres: number;
  priceSatangPerLitre: number;
  inputMode: "price" | "volume";
  fullTank: boolean;
  missedFillupBefore: boolean;
  fuelType: string;
  station?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  schemaVersion: 1;
  activeVehicleId?: string;
  calculatorInputs: Record<string, string>;
  lastBackupAt?: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  name: string;
  startDate: string;
  status?: "ongoing" | "completed";
  endDate?: string;
  distanceMode: "distance" | "odometer";
  distanceKm?: number;
  startOdometerKm?: number;
  endOdometerKm?: number;
  fuelMode: "estimated" | "actual";
  efficiencyKmPerLitre?: number;
  efficiencySource?: "manual" | "history" | "vehicle";
  actualVolumeMillilitres?: number;
  priceSatangPerLitre?: number;
  extrasSatang: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  vehicles: Vehicle[];
  fillups: Fillup[];
  trips: Trip[];
  settings: Settings;
}

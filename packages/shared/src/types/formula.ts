export interface ProfileFormula {
  name: string;
  type: string; // e.g., frame, mullion, sash, bead
  length: string; // formula
  count: string; // formula
  connection?: string; // e.g., frame-frame, frame-mullion
  position?: string[]; // e.g., ["up", "down"]
  note?: string;
}

export interface GlassFormula {
  name: string;
  type: string; // e.g., fixedGlass, sashGlass
  width: string; // formula
  height: string; // formula
  connection?: string;
  note?: string;
}

export interface AddonFormula {
  name: string;
  count: string; // formula
  category: string; // e.g., bar, sash
  note?: string;
}

export interface PricingRule {
  name: string;
  price: number | string;
  type: string; // e.g., area, sash, corner, glass
  scope: string; // e.g., all, per, per_meter
  minArea?: number;
  condition?: string;
}

export interface Formula {
  name: string;
  profiles: ProfileFormula[];
  glass: GlassFormula[];
  addons: AddonFormula[];
  parameters: Record<string, number>;
  pricing: PricingRule[];
}

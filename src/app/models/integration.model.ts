export type ExerciseKind = 'table' | 'function';
export type MethodId = 'trap' | 's13' | 's38' | 'mixed' | 's13trap';
export type SpecialMode = 'standard' | 'volume' | 'surface';

export interface EditablePoint {
  id: number;
  x: number | null;
  y: number | null;
}

export interface ParameterDef {
  key: string;
  label: string;
  value: number;
  unit: string;
  step?: number;
}

export interface ExerciseDefinition {
  id: number;
  title: string;
  shortTitle: string;
  area: string;
  context: string;
  objective: string;
  kind: ExerciseKind;
  variable: string;
  xLabel: string;
  xUnit: string;
  yLabel: string;
  yUnit: string;
  resultLabel: string;
  resultUnit: string;
  equation: string;
  formula?: string;
  lower?: number;
  upper?: number;
  n?: number;
  parameters?: ParameterDef[];
  points?: EditablePoint[];
  defaultMethod: MethodId;
  notes: string[];
  reference?: number | null;
  referenceLabel?: string;
  specialMode?: SpecialMode;
}

export interface IntegrationRow {
  i: number;
  x: number;
  fx: number;
  weight: number;
  contribution: number;
}

export interface IntegrationResult {
  method: MethodId;
  label: string;
  value: number;
  h: number;
  n: number;
  rows: IntegrationRow[];
  valid: boolean;
  message: string;
}

export interface PlotPoint {
  x: number;
  y: number;
}

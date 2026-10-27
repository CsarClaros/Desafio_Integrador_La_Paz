import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EditablePoint,
  ExerciseDefinition,
  IntegrationResult,
  MethodId,
  ParameterDef,
  PlotPoint,
  SpecialMode
} from './models/integration.model';
import { IntegrationService } from './services/integration.service';

type ModalType = 'methods' | 'validation' | 'exercise' | 'limitations' | null;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class App implements OnInit {
  exercises: ExerciseDefinition[] = [];
  private defaults: ExerciseDefinition[] = [];
  current!: ExerciseDefinition;
  activeId = 19;
  method: MethodId = 'mixed';
  integration: IntegrationResult | null = null;
  comparison: IntegrationResult[] = [];
  graphCurve: PlotPoint[] = [];
  graphNodes: PlotPoint[] = [];
  errorMessage = '';
  modal: ModalType = null;
  private nextPointId = 1000;

  readonly methods: { id: MethodId; label: string }[] = [
    { id: 'trap', label: 'Trapecio compuesto' },
    { id: 's13', label: 'Simpson 1/3' },
    { id: 's38', label: 'Simpson 3/8' },
    { id: 'mixed', label: 'Simpson combinado 1/3 + 3/8' },
    { id: 's13trap', label: 'Simpson 1/3 + trapecio final' }
  ];

  readonly gridTicks = [0, 1, 2, 3, 4];

  constructor(private readonly service: IntegrationService) {
    this.exercises = this.buildExercises();
    this.defaults = this.buildExercises();
    this.current = this.exercises[0];
  }

  ngOnInit(): void {
    this.selectExercise(19);
  }

  selectExercise(id: number): void {
    this.activeId = Number(id);
    const found = this.exercises.find(exercise => exercise.id === this.activeId);
    if (!found) return;
    this.current = found;
    this.method = found.defaultMethod;
    this.calculate();
  }

  calculate(): void {
    this.errorMessage = '';
    this.integration = null;
    this.comparison = [];
    this.graphCurve = [];
    this.graphNodes = [];

    try {
      const nodes = this.integrationNodes();
      this.graphNodes = nodes;
      this.integration = this.service.integrate(nodes, this.method);
      this.comparison = this.methods
        .map(item => this.service.integrate(nodes, item.id))
        .filter(result => result.valid);

      if (!this.integration.valid) this.errorMessage = this.integration.message;
      this.graphCurve = this.buildGraphCurve(nodes);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No fue posible realizar el cálculo.';
    }
  }

  private integrationNodes(): PlotPoint[] {
    if (this.current.kind === 'function') {
      const formula = this.current.formula ?? '';
      const a = Number(this.current.lower);
      const b = Number(this.current.upper);
      const n = Number(this.current.n);
      return this.service.functionNodes(formula, a, b, n, this.parameterMap());
    }

    const raw = this.service.sanitizePoints(this.current.points ?? []);
    if (this.current.id !== 27) return raw;

    const mode = this.current.specialMode ?? 'volume';
    return raw.map(point => {
      const radius = point.y / 2;
      const y = mode === 'surface' ? 2 * Math.PI * radius : Math.PI * radius * radius;
      return { x: point.x, y };
    });
  }

  private buildGraphCurve(nodes: PlotPoint[]): PlotPoint[] {
    if (this.current.kind === 'function') {
      return this.service.functionCurve(
        this.current.formula ?? '',
        Number(this.current.lower),
        Number(this.current.upper),
        this.parameterMap()
      );
    }
    return nodes;
  }

  setSpecialMode(mode: SpecialMode): void {
    this.current.specialMode = mode;
    this.calculate();
  }

  addPoint(): void {
    if (this.current.kind !== 'table') return;
    const points = this.current.points ?? (this.current.points = []);
    const last = points[points.length - 1];
    const previous = points[points.length - 2];
    const step = last && previous && last.x !== null && previous.x !== null ? Number(last.x) - Number(previous.x) : 1;
    const nextX = last?.x !== null && last?.x !== undefined ? Number(last.x) + step : 0;
    points.push({ id: this.nextPointId++, x: nextX, y: 0 });
    this.calculate();
  }

  removePoint(index: number): void {
    const points = this.current.points;
    if (!points) return;
    if (points.length <= 2) {
      this.errorMessage = 'Deben mantenerse al menos dos puntos.';
      return;
    }
    points.splice(index, 1);
    this.calculate();
  }

  restoreCurrent(): void {
    const original = this.defaults.find(exercise => exercise.id === this.current.id);
    if (!original) return;
    const index = this.exercises.findIndex(exercise => exercise.id === this.current.id);
    const restored = this.cloneExercise(original);
    this.exercises[index] = restored;
    this.current = restored;
    this.activeId = restored.id;
    this.method = restored.defaultMethod;
    this.calculate();
  }

  previousExercise(): void {
    const index = this.exercises.findIndex(exercise => exercise.id === this.current.id);
    const target = this.exercises[(index - 1 + this.exercises.length) % this.exercises.length];
    this.selectExercise(target.id);
  }

  nextExercise(): void {
    const index = this.exercises.findIndex(exercise => exercise.id === this.current.id);
    const target = this.exercises[(index + 1) % this.exercises.length];
    this.selectExercise(target.id);
  }

  get currentValue(): number | null {
    if (!this.integration?.valid || !Number.isFinite(this.integration.value)) return null;
    return this.integration.value * this.resultScale;
  }

  get resultScale(): number {
    return this.current.id === 19 ? 1 / 3600 : 1;
  }

  get currentResultUnit(): string {
    if (this.current.id === 27) return this.current.specialMode === 'surface' ? 'in²' : 'in³';
    return this.current.resultUnit;
  }

  get currentResultLabel(): string {
    if (this.current.id === 27) return this.current.specialMode === 'surface' ? 'Superficie simplificada' : 'Volumen estimado';
    return this.current.resultLabel;
  }

  get methodLabel(): string {
    return this.service.methodLabels[this.method];
  }

  comparisonValue(result: IntegrationResult): number {
    return result.value * this.resultScale;
  }

  get referenceValue(): number | null {
    const p = this.parameterMap();
    const lower = Number(this.current.lower ?? 0);
    const upper = Number(this.current.upper ?? 0);

    switch (this.current.id) {
      case 22: {
        const c = p['c'] ?? 24;
        return c * (Math.sinh(upper / c) - Math.sinh(lower / c));
      }
      case 23: {
        const vmax = p['V0'] ?? 80;
        const radius = p['R'] ?? 0.25;
        const antiderivative = (r: number): number => {
          const u = 1 - r / radius;
          if (u < 0) return NaN;
          return -2 * Math.PI * vmax * radius * radius * ((7 / 8) * Math.pow(u, 8 / 7) - (7 / 15) * Math.pow(u, 15 / 7));
        };
        const value = antiderivative(upper) - antiderivative(lower);
        return Number.isFinite(value) ? value : null;
      }
      case 24: {
        const b = p['b'] ?? 5;
        return -8 * b * (Math.cos(upper / 2) - Math.cos(lower / 2));
      }
      case 25: {
        const m = p['m'] ?? 500;
        const g0 = p['g0'] ?? 9.81;
        const radius = p['R'] ?? 6371000;
        return m * g0 * radius * radius * (1 / (radius + lower) - 1 / (radius + upper));
      }
      case 26:
        return 9940;
      default:
        return this.current.reference ?? null;
    }
  }

  absoluteError(value = this.currentValue): number | null {
    const reference = this.referenceValue;
    if (value === null || reference === null || !Number.isFinite(reference)) return null;
    return Math.abs(reference - value);
  }

  percentError(value = this.currentValue): number | null {
    const reference = this.referenceValue;
    const abs = this.absoluteError(value);
    if (abs === null || reference === null || reference === 0) return null;
    return 100 * abs / Math.abs(reference);
  }

  comparisonPercentError(result: IntegrationResult): number | null {
    return this.percentError(this.comparisonValue(result));
  }

  get equivalentText(): string {
    const value = this.currentValue;
    if (value === null) return '';
    if (this.current.id === 19) return `${this.format(value * 1609.344)} m`;
    if (this.current.id === 20) return `${this.format(value * 0.112984829)} J`;
    return '';
  }

  get dataStatus(): string {
    if (this.current.id === 26 && (this.current.points ?? []).some(point => point.y === null)) {
      return 'Faltan anchuras digitalizadas';
    }
    return this.current.kind === 'table' ? `${(this.current.points ?? []).length} nodos editables` : `n = ${this.current.n}`;
  }

  get validationMessage(): string {
    if (!this.integration) return 'Sin cálculo';
    if (!this.integration.valid) return this.integration.message;
    const base = `Configuración válida: n = ${this.integration.n}, h = ${this.format(this.integration.h)}.`;
    return this.integration.message ? `${base} ${this.integration.message}` : base;
  }

  get graphXMin(): number {
    return this.graphCurve.length ? Math.min(...this.graphCurve.map(point => point.x)) : 0;
  }

  get graphXMax(): number {
    return this.graphCurve.length ? Math.max(...this.graphCurve.map(point => point.x)) : 1;
  }

  get graphYMin(): number {
    if (!this.graphCurve.length) return 0;
    return Math.min(0, ...this.graphCurve.map(point => point.y));
  }

  get graphYMax(): number {
    if (!this.graphCurve.length) return 1;
    const max = Math.max(0, ...this.graphCurve.map(point => point.y));
    const min = this.graphYMin;
    return max === min ? max + 1 : max + (max - min) * 0.08;
  }

  sx(x: number): number {
    return 66 + (x - this.graphXMin) / (this.graphXMax - this.graphXMin || 1) * 718;
  }

  sy(y: number): number {
    return 306 - (y - this.graphYMin) / (this.graphYMax - this.graphYMin || 1) * 266;
  }

  get curvePath(): string {
    return this.graphCurve.map((point, index) => `${index ? 'L' : 'M'} ${this.sx(point.x).toFixed(2)} ${this.sy(point.y).toFixed(2)}`).join(' ');
  }

  get areaPath(): string {
    if (!this.graphCurve.length) return '';
    const first = this.graphCurve[0];
    const last = this.graphCurve[this.graphCurve.length - 1];
    const baseline = this.sy(0);
    return `M ${this.sx(first.x).toFixed(2)} ${baseline.toFixed(2)} ` +
      this.graphCurve.map(point => `L ${this.sx(point.x).toFixed(2)} ${this.sy(point.y).toFixed(2)}`).join(' ') +
      ` L ${this.sx(last.x).toFixed(2)} ${baseline.toFixed(2)} Z`;
  }

  xTickX(index: number): number { return 66 + index * 718 / 4; }
  yTickY(index: number): number { return 40 + index * 266 / 4; }
  xTickValue(index: number): number { return this.graphXMin + index * (this.graphXMax - this.graphXMin) / 4; }
  yTickValue(index: number): number { return this.graphYMax - index * (this.graphYMax - this.graphYMin) / 4; }

  get graphYLabel(): string {
    if (this.current.id === 27) return this.current.specialMode === 'surface' ? '2πr' : 'πr²';
    return this.current.yLabel;
  }

  get formulaExplanation(): string {
    if (this.current.id === 27) {
      return this.current.specialMode === 'surface'
        ? 'S_simplificada = ∫ 2πr(z) dz. Esta expresión omite el factor de pendiente √(1+(r′)²).'
        : 'V = π∫ r(z)² dz, con r = d/2.';
    }
    return this.current.equation;
  }

  openModal(type: Exclude<ModalType, null>): void { this.modal = type; }
  closeModal(): void { this.modal = null; }

  trackByPoint(_: number, point: EditablePoint): number { return point.id; }
  trackByParameter(_: number, parameter: ParameterDef): string { return parameter.key; }
  trackByExercise(_: number, exercise: ExerciseDefinition): number { return exercise.id; }
  trackByIndex(index: number): number { return index; }

  format(value: number | null | undefined, digits = 6): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const absolute = Math.abs(value);
    if (absolute >= 1e8 || (absolute > 0 && absolute < 1e-5)) return value.toExponential(digits);
    return value.toLocaleString('es-BO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  private parameterMap(): Record<string, number> {
    const map: Record<string, number> = {};
    for (const parameter of this.current.parameters ?? []) map[parameter.key] = Number(parameter.value);
    return map;
  }

  private cloneExercise(exercise: ExerciseDefinition): ExerciseDefinition {
    return {
      ...exercise,
      parameters: exercise.parameters?.map(parameter => ({ ...parameter })),
      points: exercise.points?.map(point => ({ ...point })),
      notes: [...exercise.notes]
    };
  }

  private points(values: Array<[number, number | null]>): EditablePoint[] {
    return values.map(([x, y]) => ({ id: this.nextPointId++, x, y }));
  }

  private buildExercises(): ExerciseDefinition[] {
    return [
      {
        id: 19,
        title: 'Distancia de un vehículo experimental',
        shortTitle: 'Transporte urbano',
        area: 'Transporte',
        context: 'Un vehículo experimental registra su velocidad durante los primeros siete segundos. La integral de la velocidad respecto del tiempo permite estimar la distancia recorrida.',
        objective: 'Estimar la distancia total y convertir el resultado de millas a metros.',
        kind: 'table', variable: 't', xLabel: 'Tiempo', xUnit: 's', yLabel: 'Velocidad', yUnit: 'mi/h',
        resultLabel: 'Distancia recorrida', resultUnit: 'mi',
        equation: 'd = ∫₀⁷ v(t) dt; como t está en segundos, el área se divide entre 3600.',
        points: this.points([[0,0],[1,14],[2,39],[3,69],[4,95],[5,114],[6,129],[7,139]]),
        defaultMethod: 'mixed',
        notes: ['El documento usa Simpson 1/3 entre 0 y 4 s y Simpson 3/8 entre 4 y 7 s.', 'No se proporciona un valor exacto de referencia.']
      },
      {
        id: 20,
        title: 'Trabajo de una banda elástica',
        shortTitle: 'Elasticidad',
        area: 'Mecánica',
        context: 'Una banda elástica se estira y se mide la fuerza aplicada para distintos desplazamientos.',
        objective: 'Integrar F(x) para estimar el trabajo realizado por la fuerza.',
        kind: 'table', variable: 'x', xLabel: 'Desplazamiento', xUnit: 'in', yLabel: 'Fuerza', yUnit: 'lb',
        resultLabel: 'Trabajo', resultUnit: 'lb·in',
        equation: 'W = ∫₀²·⁸ F(x) dx.',
        points: this.points([[0,0],[0.4,0.85],[0.8,1.30],[1.2,1.60],[1.6,1.87],[2.0,2.14],[2.4,2.34],[2.8,2.52]]),
        defaultMethod: 'mixed',
        notes: ['Con 7 subintervalos se combina Simpson 1/3 en los primeros 4 y Simpson 3/8 en los últimos 3.', 'Se muestra también la equivalencia aproximada en joules.']
      },
      {
        id: 21,
        title: 'Área bajo un perfil topográfico',
        shortTitle: 'Perfil topográfico',
        area: 'Geometría / topografía',
        context: 'Las coordenadas fueron digitalizadas visualmente de una gráfica. Por ello representan datos ilustrativos y su precisión depende de la lectura original.',
        objective: 'Estimar el área bajo el perfil entre x = 1 y x = 10.',
        kind: 'table', variable: 'x', xLabel: 'Posición', xUnit: 'u', yLabel: 'Altura', yUnit: 'u',
        resultLabel: 'Área bajo el perfil', resultUnit: 'u²',
        equation: 'A = ∫₁¹⁰ y(x) dx.',
        points: this.points([[1,1.3],[2,3.7],[3,4.6],[4,4.4],[5,2.7],[6,2.5],[7,3.6],[8,5.3],[9,6.0],[10,5.9]]),
        defaultMethod: 's13trap',
        notes: ['El solucionario emplea Simpson 1/3 sobre 8 intervalos y trapecio en el noveno.', 'Como n = 9 también es múltiplo de 3, la aplicación permite comparar con Simpson 3/8 completo.']
      },
      {
        id: 22,
        title: 'Longitud de un cable con forma de catenaria',
        shortTitle: 'Cable suspendido',
        area: 'Geometría',
        context: 'El cable se modela mediante y = c cosh(x/c). Es un modelo geométrico simplificado y no un cálculo estructural de un teleférico real.',
        objective: 'Estimar la longitud de arco entre los apoyos.',
        kind: 'function', variable: 'x', xLabel: 'Posición horizontal', xUnit: 'ft', yLabel: 'Integrando de longitud', yUnit: '',
        resultLabel: 'Longitud del cable', resultUnit: 'ft',
        equation: 'L = ∫ √(1 + [y′(x)]²) dx = ∫ cosh(x/c) dx.',
        formula: 'cosh(x/c)', lower: -12, upper: 26, n: 8,
        parameters: [{ key:'c', label:'Parámetro c', value:24, unit:'ft', step:1 }],
        defaultMethod: 's13',
        notes: ['El valor analítico se calcula con c[sinh(b/c) − sinh(a/c)].', 'Con n = 8, Simpson 1/3 es compatible; Simpson 3/8 no lo es.']
      },
      {
        id: 23,
        title: 'Caudal en una tubería circular',
        shortTitle: 'Abastecimiento de agua',
        area: 'Fluidos',
        context: 'Se integra un perfil turbulento de velocidad en una sección circular de tubería.',
        objective: 'Estimar el caudal volumétrico Q.',
        kind: 'function', variable: 'r', xLabel: 'Radio', xUnit: 'in', yLabel: '2πrv(r)', yUnit: 'in²/s',
        resultLabel: 'Caudal', resultUnit: 'in³/s',
        equation: 'Q = ∫₀ᴿ 2πr V₀(1 − r/R)^(1/7) dr.',
        formula: '2*pi*r*V0*(1-r/R)^(1/7)', lower: 0, upper: 0.25, n: 8,
        parameters: [
          { key:'V0', label:'Velocidad máxima V₀', value:80, unit:'in/s', step:1 },
          { key:'R', label:'Radio R', value:0.25, unit:'in', step:0.01 }
        ],
        defaultMethod: 's13',
        notes: ['Cerca de la pared la derivada del perfil cambia con rapidez, por lo que la convergencia es más lenta.', 'Para los parámetros iniciales, la referencia es 49π/12.']
      },
      {
        id: 24,
        title: 'Longitud de una cardioide paramétrica',
        shortTitle: 'Trayectoria cardioide',
        area: 'Geometría paramétrica',
        context: 'La trayectoria se define por x(t)=2b cos(t)−b cos(2t) y y(t)=2b sin(t)−b sin(2t).',
        objective: 'Estimar la longitud total de la curva para t ∈ [0, 2π].',
        kind: 'function', variable: 't', xLabel: 'Parámetro t', xUnit: 'rad', yLabel: 'Rapidez paramétrica', yUnit: 'u/rad',
        resultLabel: 'Longitud de la cardioide', resultUnit: 'u',
        equation: 'L = ∫₀²π √([x′(t)]²+[y′(t)]²)dt = ∫₀²π 4b sin(t/2)dt.',
        formula: '4*b*sin(t/2)', lower: 0, upper: 2 * Math.PI, n: 8,
        parameters: [{ key:'b', label:'Parámetro b', value:5, unit:'u', step:0.5 }],
        defaultMethod: 's13',
        notes: ['Para b = 5 y el intervalo completo, la longitud exacta es 80.', 'La función simplificada es válida en el intervalo indicado, donde sin(t/2) no es negativa.']
      },
      {
        id: 25,
        title: 'Variación de energía potencial gravitatoria',
        shortTitle: 'Energía gravitatoria',
        area: 'Física / energía',
        context: 'Se considera la disminución de la aceleración gravitatoria con la altura para elevar un satélite desde la superficie terrestre.',
        objective: 'Estimar el incremento de energía potencial al elevar un satélite hasta 800 km.',
        kind: 'function', variable: 'y', xLabel: 'Altura', xUnit: 'm', yLabel: 'Fuerza gravitatoria', yUnit: 'N',
        resultLabel: 'Variación de energía potencial', resultUnit: 'J',
        equation: 'ΔU = ∫₀ʰ m g₀ R²/(R+y)² dy.',
        formula: 'm*g0*R^2/(R+y)^2', lower: 0, upper: 800000, n: 8,
        parameters: [
          { key:'m', label:'Masa m', value:500, unit:'kg', step:10 },
          { key:'g0', label:'Gravedad g₀', value:9.81, unit:'m/s²', step:0.01 },
          { key:'R', label:'Radio terrestre R', value:6371000, unit:'m', step:1000 }
        ],
        defaultMethod: 's13',
        notes: ['La referencia analítica se obtiene integrando (R+y)⁻².', 'Simpson 1/3 con n = 8 ofrece una aproximación muy cercana al valor analítico.']
      },
      {
        id: 26,
        title: 'Área de la superficie de un lago',
        shortTitle: 'Superficie de lago',
        area: 'Geografía / geometría',
        context: 'El ejercicio original solicita medir anchuras en una figura cada 20 millas. El documento no proporciona una tabla oficial de anchuras digitalizadas.',
        objective: 'Estimar el área a partir de anchuras w(x) y compararla con la referencia de 9 940 mi².',
        kind: 'table', variable: 'x', xLabel: 'Posición longitudinal', xUnit: 'mi', yLabel: 'Anchura w(x)', yUnit: 'mi',
        resultLabel: 'Área estimada', resultUnit: 'mi²',
        equation: 'A = ∫₄₀²⁶⁰ w(x) dx.',
        points: this.points([[40,null],[60,null],[80,null],[100,null],[120,null],[140,null],[160,null],[180,null],[200,null],[220,null],[240,null],[260,null]]),
        defaultMethod: 'mixed', reference: 9940,
        referenceLabel: 'Área de referencia del ejercicio original',
        notes: ['Sin una tabla común de anchuras no existe una única aproximación numérica reproducible.', 'Los campos se dejan editables y vacíos deliberadamente para no inventar datos.']
      },
      {
        id: 27,
        title: 'Volumen y superficie simplificada de un objeto alargado',
        shortTitle: 'Objeto alargado',
        area: 'Geometría de revolución',
        context: 'Se dispone del diámetro de un objeto a distintas posiciones del eje. A partir de r=d/2 se integra el área de cada sección para estimar volumen.',
        objective: 'Estimar el volumen y analizar la diferencia entre una fórmula superficial simplificada y el área real de revolución.',
        kind: 'table', variable: 'z', xLabel: 'Posición z', xUnit: 'in', yLabel: 'Diámetro d', yUnit: 'in',
        resultLabel: 'Volumen estimado', resultUnit: 'in³',
        equation: 'V = π∫₀¹² r² dz, con r=d/2.',
        points: this.points([[0,0],[1,2.6],[2,3.2],[3,4.8],[4,5.6],[5,6.0],[6,6.2],[7,6.0],[8,5.6],[9,4.8],[10,3.3],[11,2.6],[12,0]]),
        defaultMethod: 's13', specialMode: 'volume',
        notes: ['La fórmula S=2π∫r dz omite la pendiente y no representa el área superficial exacta.', 'El área real de revolución requiere S=2π∫r√(1+(r′)²)dz.']
      }
    ];
  }
}

import { Injectable } from '@angular/core';
import { EditablePoint, IntegrationResult, MethodId, PlotPoint } from '../models/integration.model';

@Injectable({ providedIn: 'root' })
export class IntegrationService {
  readonly methodLabels: Record<MethodId, string> = {
    trap: 'Trapecio compuesto',
    s13: 'Simpson 1/3',
    s38: 'Simpson 3/8',
    mixed: 'Simpson combinado 1/3 + 3/8',
    s13trap: 'Simpson 1/3 + trapecio final'
  };

  sanitizePoints(points: EditablePoint[]): PlotPoint[] {
    if (points.length < 2) throw new Error('Se requieren al menos dos puntos.');
    const clean = points.map((p, index) => {
      const x = Number(p.x);
      const y = Number(p.y);
      if (p.x === null || p.y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`El punto ${index + 1} contiene un dato vacío o no numérico.`);
      }
      return { x, y };
    });
    for (let i = 1; i < clean.length; i++) {
      if (clean[i].x <= clean[i - 1].x) {
        throw new Error('Los valores de la variable independiente deben estar en orden estrictamente creciente.');
      }
    }
    return clean;
  }

  uniformStep(points: PlotPoint[]): number {
    const h = points[1].x - points[0].x;
    const tolerance = Math.max(1e-10, Math.abs(h) * 1e-8);
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i + 1].x - points[i].x;
      if (Math.abs(current - h) > tolerance) {
        throw new Error('Los nodos no están igualmente espaciados; los métodos compuestos de esta práctica requieren h constante.');
      }
    }
    return h;
  }

  integrate(points: PlotPoint[], method: MethodId): IntegrationResult {
    if (points.length < 2) return this.invalid(method, 0, 0, 'Se requieren al menos dos nodos.');
    let h = 0;
    try { h = this.uniformStep(points); }
    catch (error) { return this.invalid(method, 0, points.length - 1, error instanceof Error ? error.message : 'Espaciado inválido.'); }

    const n = points.length - 1;
    switch (method) {
      case 'trap': return this.trapezoid(points, h);
      case 's13': return this.simpson13(points, h);
      case 's38': return this.simpson38(points, h);
      case 'mixed': return this.mixed(points, h);
      case 's13trap': return this.simpson13PlusTrap(points, h);
    }
  }

  private trapezoid(points: PlotPoint[], h: number): IntegrationResult {
    const n = points.length - 1;
    const weights = points.map((_, i) => i === 0 || i === n ? h / 2 : h);
    return this.compose('trap', points, weights, h, '');
  }

  private simpson13(points: PlotPoint[], h: number): IntegrationResult {
    const n = points.length - 1;
    if (n % 2 !== 0) return this.invalid('s13', h, n, 'Simpson 1/3 requiere un número par de subintervalos.');
    const weights = points.map((_, i) => {
      if (i === 0 || i === n) return h / 3;
      return (i % 2 === 1 ? 4 : 2) * h / 3;
    });
    return this.compose('s13', points, weights, h, '');
  }

  private simpson38(points: PlotPoint[], h: number): IntegrationResult {
    const n = points.length - 1;
    if (n % 3 !== 0) return this.invalid('s38', h, n, 'Simpson 3/8 requiere que n sea múltiplo de 3.');
    const weights = points.map((_, i) => {
      if (i === 0 || i === n) return 3 * h / 8;
      return (i % 3 === 0 ? 2 : 3) * 3 * h / 8;
    });
    return this.compose('s38', points, weights, h, '');
  }

  private mixed(points: PlotPoint[], h: number): IntegrationResult {
    const n = points.length - 1;
    if (n < 5 || n % 2 === 0) {
      return this.invalid('mixed', h, n, 'La combinación 1/3 + 3/8 se usa aquí con n impar: Simpson 1/3 en n−3 subintervalos y 3/8 en los últimos 3.');
    }
    const split = n - 3;
    if (split % 2 !== 0 || split < 2) return this.invalid('mixed', h, n, 'No es posible construir la combinación solicitada con este n.');
    const weights = new Array<number>(points.length).fill(0);
    for (let i = 0; i <= split; i++) {
      const coef = i === 0 || i === split ? 1 : (i % 2 === 1 ? 4 : 2);
      weights[i] += coef * h / 3;
    }
    for (let j = 0; j <= 3; j++) {
      const i = split + j;
      const coef = j === 0 || j === 3 ? 1 : 3;
      weights[i] += coef * 3 * h / 8;
    }
    return this.compose('mixed', points, weights, h, `Simpson 1/3 en ${split} subintervalos y Simpson 3/8 en los últimos 3.`);
  }

  private simpson13PlusTrap(points: PlotPoint[], h: number): IntegrationResult {
    const n = points.length - 1;
    if (n < 3 || n % 2 === 0) {
      return this.invalid('s13trap', h, n, 'Esta combinación se utiliza cuando n es impar: Simpson 1/3 en n−1 subintervalos y trapecio en el último.');
    }
    const split = n - 1;
    const weights = new Array<number>(points.length).fill(0);
    for (let i = 0; i <= split; i++) {
      const coef = i === 0 || i === split ? 1 : (i % 2 === 1 ? 4 : 2);
      weights[i] += coef * h / 3;
    }
    weights[split] += h / 2;
    weights[n] += h / 2;
    return this.compose('s13trap', points, weights, h, `Simpson 1/3 en ${split} subintervalos y trapecio en el último.`);
  }

  private compose(method: MethodId, points: PlotPoint[], weights: number[], h: number, message: string): IntegrationResult {
    const rows = points.map((p, i) => ({
      i,
      x: p.x,
      fx: p.y,
      weight: weights[i],
      contribution: weights[i] * p.y
    }));
    const value = rows.reduce((sum, row) => sum + row.contribution, 0);
    return {
      method,
      label: this.methodLabels[method],
      value,
      h,
      n: points.length - 1,
      rows,
      valid: true,
      message
    };
  }

  private invalid(method: MethodId, h: number, n: number, message: string): IntegrationResult {
    return { method, label: this.methodLabels[method], value: NaN, h, n, rows: [], valid: false, message };
  }

  evaluateFormula(formula: string, x: number, params: Record<string, number>): number {
    const raw = formula.trim();
    if (!raw) throw new Error('La función está vacía.');
    if (!/^[0-9A-Za-z_+\-*/^().,\s]+$/.test(raw)) {
      throw new Error('La función contiene símbolos no permitidos.');
    }

    const allowedFunctions = new Set(['sin','cos','tan','sinh','cosh','tanh','sqrt','exp','log','abs','pow']);
    const allowedVariables = new Set(['x','t','r','y','z','pi','e', ...Object.keys(params)]);
    const tokens = raw.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    for (const token of tokens) {
      if (!allowedFunctions.has(token) && !allowedVariables.has(token)) {
        throw new Error(`Identificador no permitido en f(x): ${token}.`);
      }
    }

    let expression = raw.replace(/\^/g, '**');
    for (const fn of allowedFunctions) {
      expression = expression.replace(new RegExp(`\\b${fn}\\b`, 'g'), `Math.${fn}`);
    }
    expression = expression.replace(/\bpi\b/g, 'Math.PI').replace(/\be\b/g, 'Math.E');
    expression = expression.replace(/\b(t|r|y|z)\b/g, 'x');

    const declarations = Object.keys(params)
      .filter(key => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      .map(key => `const ${key}=Number(p[${JSON.stringify(key)}]);`)
      .join('');

    const evaluator = new Function('x', 'p', `"use strict";${declarations} return (${expression});`) as (x: number, p: Record<string, number>) => number;
    const value = evaluator(x, params);
    if (!Number.isFinite(value)) throw new Error(`La función no produce un valor finito en x = ${x}.`);
    return value;
  }

  functionNodes(formula: string, a: number, b: number, n: number, params: Record<string, number>): PlotPoint[] {
    if (!Number.isInteger(n) || n <= 0) throw new Error('n debe ser un entero positivo.');
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) throw new Error('Los límites deben cumplir b > a.');
    const h = (b - a) / n;
    const result: PlotPoint[] = [];
    for (let i = 0; i <= n; i++) {
      const x = a + i * h;
      result.push({ x, y: this.evaluateFormula(formula, x, params) });
    }
    return result;
  }

  functionCurve(formula: string, a: number, b: number, params: Record<string, number>, samples = 140): PlotPoint[] {
    const result: PlotPoint[] = [];
    for (let i = 0; i <= samples; i++) {
      const x = a + (b - a) * i / samples;
      result.push({ x, y: this.evaluateFormula(formula, x, params) });
    }
    return result;
  }
}

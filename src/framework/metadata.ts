import 'reflect-metadata';
import { Constructor, ModuleMetadata, ParameterDefinition, RouteDefinition } from './types';

export const CONTROLLER_METADATA = Symbol('controller');
export const ROUTE_METADATA = Symbol('routes');
export const PARAMETER_METADATA = Symbol('parameters');
export const MODULE_METADATA = Symbol('module');
export const INJECTABLE_METADATA = Symbol('injectable');
export const INJECT_TOKENS_METADATA = Symbol('inject_tokens');

export function setControllerPrefix(target: Constructor, prefix: string): void {
  Reflect.defineMetadata(CONTROLLER_METADATA, normalizePath(prefix), target);
}

export function getControllerPrefix(target: Constructor): string {
  return Reflect.getMetadata(CONTROLLER_METADATA, target) ?? '';
}

export function appendRoute(target: object, route: RouteDefinition): void {
  const ctor = target.constructor as Constructor;
  const routes = getRoutes(ctor);
  Reflect.defineMetadata(ROUTE_METADATA, [...routes, route], ctor);
}

export function getRoutes(target: Constructor): RouteDefinition[] {
  return Reflect.getMetadata(ROUTE_METADATA, target) ?? [];
}

export function appendParameter(target: object, propertyKey: string | symbol, parameter: ParameterDefinition): void {
  const ctor = target.constructor as Constructor;
  const existing = getParameters(ctor, String(propertyKey));
  Reflect.defineMetadata(PARAMETER_METADATA, [...existing, parameter], ctor, String(propertyKey));
}

export function getParameters(target: Constructor, propertyKey: string): ParameterDefinition[] {
  return Reflect.getMetadata(PARAMETER_METADATA, target, propertyKey) ?? [];
}

export function setModuleMetadata(target: Constructor, metadata: ModuleMetadata): void {
  Reflect.defineMetadata(MODULE_METADATA, metadata, target);
}

export function getModuleMetadata(target: Constructor): ModuleMetadata {
  return Reflect.getMetadata(MODULE_METADATA, target) ?? {};
}

export function markInjectable(target: Constructor): void {
  Reflect.defineMetadata(INJECTABLE_METADATA, true, target);
}

export function setInjectToken(target: object, index: number, token: unknown): void {
  const existing: Map<number, unknown> = Reflect.getMetadata(INJECT_TOKENS_METADATA, target) ?? new Map();
  existing.set(index, token);
  Reflect.defineMetadata(INJECT_TOKENS_METADATA, existing, target);
}

export function getInjectTokens(target: Constructor): Map<number, unknown> {
  return Reflect.getMetadata(INJECT_TOKENS_METADATA, target) ?? new Map();
}

export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  return trimmed.replace(/^\/+|\/+$/g, '');
}

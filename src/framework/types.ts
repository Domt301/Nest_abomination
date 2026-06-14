export type Constructor<T = unknown> = new (...args: any[]) => T;
export type ProviderToken<T = unknown> = Constructor<T> | symbol | string;

export interface ClassProvider<T = unknown> {
  provide: ProviderToken<T>;
  useClass: Constructor<T>;
}

export interface ValueProvider<T = unknown> {
  provide: ProviderToken<T>;
  useValue: T;
}

export interface FactoryProvider<T = unknown> {
  provide: ProviderToken<T>;
  useFactory: (...args: any[]) => T;
  inject?: ProviderToken[];
}

export type Provider<T = unknown> =
  | Constructor<T>
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>;

export interface ModuleMetadata {
  imports?: Constructor[];
  controllers?: Constructor[];
  providers?: Provider[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  propertyKey: string;
}

export type ParameterSource = 'body' | 'param' | 'query' | 'event';

export interface ParameterDefinition {
  index: number;
  source: ParameterSource;
  key?: string;
}

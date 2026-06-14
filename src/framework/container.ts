import 'reflect-metadata';
import { getInjectTokens, getModuleMetadata } from './metadata';
import { ClassProvider, Constructor, FactoryProvider, Provider, ProviderToken, ValueProvider } from './types';

type ProviderRecord =
  | { type: 'class'; token: ProviderToken; useClass: Constructor }
  | { type: 'value'; token: ProviderToken; useValue: unknown }
  | { type: 'factory'; token: ProviderToken; useFactory: (...args: any[]) => unknown; inject: ProviderToken[] };

export class Container {
  private readonly providers = new Map<ProviderToken, ProviderRecord>();
  private readonly singletons = new Map<ProviderToken, unknown>();

  static fromModule(moduleClass: Constructor): Container {
    const container = new Container();
    container.registerModule(moduleClass);
    return container;
  }

  registerModule(moduleClass: Constructor): void {
    const metadata = getModuleMetadata(moduleClass);

    for (const imported of metadata.imports ?? []) {
      this.registerModule(imported);
    }

    for (const provider of metadata.providers ?? []) {
      this.register(provider);
    }

    for (const controller of metadata.controllers ?? []) {
      this.register(controller);
    }
  }

  register(provider: Provider): void {
    if (typeof provider === 'function') {
      this.providers.set(provider, { type: 'class', token: provider, useClass: provider });
      return;
    }

    if (isClassProvider(provider)) {
      this.providers.set(provider.provide, { type: 'class', token: provider.provide, useClass: provider.useClass });
      return;
    }

    if (isValueProvider(provider)) {
      this.providers.set(provider.provide, { type: 'value', token: provider.provide, useValue: provider.useValue });
      return;
    }

    if (isFactoryProvider(provider)) {
      this.providers.set(provider.provide, {
        type: 'factory',
        token: provider.provide,
        useFactory: provider.useFactory,
        inject: provider.inject ?? [],
      });
    }
  }

  resolve<T>(token: ProviderToken<T>): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    const provider = this.providers.get(token);
    if (!provider) {
      if (typeof token === 'function') {
        this.register(token);
        return this.resolve(token);
      }

      throw new Error(`No provider registered for token ${String(token)}`);
    }

    const instance = this.instantiate(provider);
    this.singletons.set(token, instance);
    return instance as T;
  }

  private instantiate(provider: ProviderRecord): unknown {
    if (provider.type === 'value') {
      return provider.useValue;
    }

    if (provider.type === 'factory') {
      const dependencies = provider.inject.map((token) => this.resolve(token));
      return provider.useFactory(...dependencies);
    }

    const paramTypes: ProviderToken[] = Reflect.getMetadata('design:paramtypes', provider.useClass) ?? [];
    const explicitTokens = getInjectTokens(provider.useClass);
    const dependencies = paramTypes.map((type, index) => this.resolve((explicitTokens.get(index) as ProviderToken | undefined) ?? type));

    return new provider.useClass(...dependencies);
  }
}

function isClassProvider(provider: Provider): provider is ClassProvider {
  return typeof provider === 'object' && 'useClass' in provider;
}

function isValueProvider(provider: Provider): provider is ValueProvider {
  return typeof provider === 'object' && 'useValue' in provider;
}

function isFactoryProvider(provider: Provider): provider is FactoryProvider {
  return typeof provider === 'object' && 'useFactory' in provider;
}

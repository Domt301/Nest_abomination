import { appendParameter, appendRoute, markInjectable, setControllerPrefix, setInjectToken, setModuleMetadata } from './metadata';
import { HttpMethod, ModuleMetadata, ParameterSource, ProviderToken } from './types';

export function Controller(prefix = ''): ClassDecorator {
  return (target) => setControllerPrefix(target as never, prefix);
}

export function Injectable(): ClassDecorator {
  return (target) => markInjectable(target as never);
}

export function Module(metadata: ModuleMetadata): ClassDecorator {
  return (target) => setModuleMetadata(target as never, metadata);
}

export function Inject(token: ProviderToken): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => setInjectToken(target, parameterIndex, token);
}

export function Get(path = ''): MethodDecorator {
  return route('GET', path);
}

export function Post(path = ''): MethodDecorator {
  return route('POST', path);
}

export function Put(path = ''): MethodDecorator {
  return route('PUT', path);
}

export function Patch(path = ''): MethodDecorator {
  return route('PATCH', path);
}

export function Delete(path = ''): MethodDecorator {
  return route('DELETE', path);
}

export function Body(): ParameterDecorator {
  return parameter('body');
}

export function Param(key?: string): ParameterDecorator {
  return parameter('param', key);
}

export function Query(key?: string): ParameterDecorator {
  return parameter('query', key);
}

export function Event(): ParameterDecorator {
  return parameter('event');
}

function route(method: HttpMethod, path: string): MethodDecorator {
  return (target, propertyKey) => {
    appendRoute(target, { method, path, propertyKey: String(propertyKey) });
  };
}

function parameter(source: ParameterSource, key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) {
      throw new Error('Route parameter decorators can only be used on controller methods.');
    }

    appendParameter(target, propertyKey, { index: parameterIndex, source, key });
  };
}

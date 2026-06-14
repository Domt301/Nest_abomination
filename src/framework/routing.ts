import { getControllerPrefix, getRoutes, normalizePath } from './metadata';
import { Constructor, HttpMethod } from './types';

export interface HttpRoute {
  controller: Constructor;
  controllerName: string;
  handlerName: string;
  method: HttpMethod;
  path: string;
  lambdaName: string;
}

export function discoverControllerRoutes(controllers: Constructor[]): HttpRoute[] {
  return controllers.flatMap((controller) => {
    const prefix = getControllerPrefix(controller);

    return getRoutes(controller).map((route) => {
      const path = joinPaths(prefix, route.path);
      return {
        controller,
        controllerName: controller.name,
        handlerName: route.propertyKey,
        method: route.method,
        path: `/${path}`,
        lambdaName: `${route.method.toLowerCase()}-${path.replace(/[{}]/g, '').replace(/[^\w]+/g, '-')}`,
      };
    });
  });
}

function joinPaths(...parts: string[]): string {
  const joined = parts.map(normalizePath).filter(Boolean).join('/');
  return joined || '';
}

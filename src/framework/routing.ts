import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

type Constructor<T = unknown> = new (...args: any[]) => T;
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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
    const prefix = getNestPath(Reflect.getMetadata(PATH_METADATA, controller));
    const prototype = controller.prototype;

    return Object.getOwnPropertyNames(prototype)
      .filter((propertyKey) => propertyKey !== 'constructor')
      .flatMap((propertyKey) => {
        const handler = prototype[propertyKey];
        const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        const routePath = Reflect.getMetadata(PATH_METADATA, handler);

        if (requestMethod === undefined || routePath === undefined) {
          return [];
        }

        const method = toHttpMethod(requestMethod);
        const path = joinPaths(prefix, getNestPath(routePath));

        if (!method) {
          return [];
        }

        return [
          {
            controller,
            controllerName: controller.name,
            handlerName: propertyKey,
            method,
            path: `/${path}`,
            lambdaName: `${method.toLowerCase()}-${path.replace(/[{}]/g, '').replace(/[^\w]+/g, '-')}`,
          },
        ];
      });
  });
}

function toHttpMethod(method: RequestMethod): HttpMethod | undefined {
  switch (method) {
    case RequestMethod.GET:
      return 'GET';
    case RequestMethod.POST:
      return 'POST';
    case RequestMethod.PUT:
      return 'PUT';
    case RequestMethod.PATCH:
      return 'PATCH';
    case RequestMethod.DELETE:
      return 'DELETE';
    default:
      return undefined;
  }
}

function getNestPath(path: string | string[] | undefined): string {
  if (Array.isArray(path)) {
    if (path.length !== 1) {
      throw new Error('This CDK adapter supports one path per controller or route handler.');
    }

    return path[0];
  }

  return path ?? '';
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }

  return trimmed.replace(/^\/+|\/+$/g, '');
}

function joinPaths(...parts: string[]): string {
  const joined = parts.map(normalizePath).filter(Boolean).join('/');
  return joined || '';
}

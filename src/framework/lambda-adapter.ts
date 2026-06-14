import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Container } from './container';
import { getParameters } from './metadata';
import { Constructor } from './types';

export interface LambdaEndpointOptions {
  module: Constructor;
  controller: Constructor;
  handlerName: string;
}

export function createLambdaEndpoint(options: LambdaEndpointOptions) {
  const container = Container.fromModule(options.module);
  const controller = container.resolve<any>(options.controller);
  const handler = controller[options.handlerName]?.bind(controller);

  if (typeof handler !== 'function') {
    throw new Error(`${options.controller.name}.${options.handlerName} is not a function.`);
  }

  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const args = buildArguments(options.controller, options.handlerName, event);
      const result = await handler(...args);

      return {
        statusCode: inferStatusCode(event.requestContext.http.method, result),
        headers: { 'content-type': 'application/json' },
        body: result === undefined ? '' : JSON.stringify(result),
      };
    } catch (error) {
      return errorResponse(error);
    }
  };
}

function buildArguments(controller: Constructor, handlerName: string, event: APIGatewayProxyEventV2): unknown[] {
  const parameters = getParameters(controller, handlerName);
  const args: unknown[] = [];

  for (const parameter of parameters) {
    if (parameter.source === 'body') {
      args[parameter.index] = parseBody(event.body);
    }

    if (parameter.source === 'param') {
      args[parameter.index] = parameter.key ? event.pathParameters?.[parameter.key] : event.pathParameters;
    }

    if (parameter.source === 'query') {
      args[parameter.index] = parameter.key ? event.queryStringParameters?.[parameter.key] : event.queryStringParameters;
    }

    if (parameter.source === 'event') {
      args[parameter.index] = event;
    }
  }

  return args;
}

function parseBody(body: string | undefined): unknown {
  if (!body) {
    return undefined;
  }

  return JSON.parse(body);
}

function inferStatusCode(method: string, result: unknown): number {
  if (method === 'POST') {
    return 201;
  }

  if (result === undefined || result === null) {
    return 204;
  }

  return 200;
}

function errorResponse(error: unknown): APIGatewayProxyResultV2 {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 500;

  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  };
}

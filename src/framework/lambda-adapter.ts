import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { HttpException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { NestFactory } from '@nestjs/core';
import { isObservable, lastValueFrom } from 'rxjs';

type Constructor<T = unknown> = new (...args: any[]) => T;

export interface LambdaEndpointOptions {
  module: Constructor;
  controller: Constructor;
  handlerName: string;
}

export function createLambdaEndpoint(options: LambdaEndpointOptions) {
  let controllerPromise: Promise<any> | undefined;

  const getController = async () => {
    controllerPromise ??= NestFactory.createApplicationContext(options.module, { logger: false }).then((app) =>
      app.get(options.controller, { strict: false }),
    );

    return controllerPromise;
  };

  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const controller = await getController();
      const handler = controller[options.handlerName]?.bind(controller);

      if (typeof handler !== 'function') {
        throw new Error(`${options.controller.name}.${options.handlerName} is not a function.`);
      }

      const args = buildArguments(options.controller, options.handlerName, event);
      const result = await resolveReturnValue(handler(...args));

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
  const parameters = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handlerName) ?? {};
  const args: unknown[] = [];

  for (const [metadataKey, metadata] of Object.entries<NestRouteArgumentMetadata>(parameters)) {
    const paramType = Number(metadataKey.split(':')[0]);
    args[metadata.index] = extractArgument(paramType, metadata.data, event);
  }

  return args;
}

interface NestRouteArgumentMetadata {
  index: number;
  data?: string;
}

function extractArgument(paramType: number, data: string | undefined, event: APIGatewayProxyEventV2): unknown {
  if (paramType === RouteParamtypes.BODY) {
    const body = parseBody(event.body);
    return data && typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[data] : body;
  }

  if (paramType === RouteParamtypes.PARAM) {
    return data ? event.pathParameters?.[data] : event.pathParameters;
  }

  if (paramType === RouteParamtypes.QUERY) {
    return data ? event.queryStringParameters?.[data] : event.queryStringParameters;
  }

  if (paramType === RouteParamtypes.HEADERS) {
    return data ? event.headers[data.toLowerCase()] : event.headers;
  }

  if (paramType === RouteParamtypes.REQUEST) {
    return event;
  }

  if (paramType === RouteParamtypes.IP) {
    return event.requestContext.http.sourceIp;
  }

  return undefined;
}

function parseBody(body: string | undefined): unknown {
  if (!body) {
    return undefined;
  }

  return JSON.parse(body);
}

async function resolveReturnValue(value: unknown): Promise<unknown> {
  if (isObservable(value)) {
    return lastValueFrom(value);
  }

  return value;
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
  if (error instanceof HttpException) {
    const response = error.getResponse();
    return {
      statusCode: error.getStatus(),
      headers: { 'content-type': 'application/json' },
      body: typeof response === 'string' ? JSON.stringify({ message: response }) : JSON.stringify(response),
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 500;

  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  };
}

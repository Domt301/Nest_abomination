import 'reflect-metadata';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod as CdkHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { controllers } from '../src/app/app.module';
import { discoverControllerRoutes } from '../src/framework';

export class CrudApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'UsersTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new HttpApi(this, 'CrudApi', {
      apiName: 'nest-abomination-crud-api',
    });

    for (const route of discoverControllerRoutes(controllers)) {
      const endpoint = new NodejsFunction(this, `${pascal(route.lambdaName)}Lambda`, {
        runtime: Runtime.NODEJS_20_X,
        entry: path.join(__dirname, '../src/lambda/endpoint.ts'),
        handler: 'handler',
        environment: {
          TABLE_NAME: table.tableName,
          CONTROLLER_NAME: route.controllerName,
          HANDLER_NAME: route.handlerName,
        },
      });

      table.grantReadWriteData(endpoint);

      api.addRoutes({
        path: route.path,
        methods: [toCdkMethod(route.method)],
        integration: new HttpLambdaIntegration(`${pascal(route.lambdaName)}Integration`, endpoint),
      });
    }

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
    });
  }
}

function pascal(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCdkMethod(method: string): CdkHttpMethod {
  const cdkMethod = CdkHttpMethod[method as keyof typeof CdkHttpMethod];
  if (!cdkMethod) {
    throw new Error(`Unsupported HTTP method ${method}`);
  }

  return cdkMethod;
}

#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CrudApiStack } from '../lib/crud-api-stack';

const app = new cdk.App();

new CrudApiStack(app, 'NestAbominationCrudApiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

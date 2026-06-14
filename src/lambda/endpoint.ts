import 'reflect-metadata';
import { createLambdaEndpoint } from '../framework';
import { AppModule, controllers } from '../app/app.module';

const controllerRegistry = Object.fromEntries(controllers.map((controller) => [controller.name, controller]));

const controllerName = process.env.CONTROLLER_NAME;
const handlerName = process.env.HANDLER_NAME;

if (!controllerName || !handlerName) {
  throw new Error('CONTROLLER_NAME and HANDLER_NAME must be configured.');
}

const controller = controllerRegistry[controllerName];
if (!controller) {
  throw new Error(`Unknown controller ${controllerName}`);
}

export const handler = createLambdaEndpoint({
  module: AppModule,
  controller,
  handlerName,
});

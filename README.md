# Nest Abomination

An intentionally over-abstracted CRUD API scaffold that uses real NestJS modules, controllers, decorators, and dependency injection while deploying as AWS Lambda functions behind API Gateway.

This project is useful as an architectural experiment, a learning exercise, or a proof that Nest metadata can be made to drive serverless infrastructure. It is not a recommendation for how ordinary CRUD APIs should be built.

## What This Builds

The current stack creates:

- An API Gateway HTTP API.
- A DynamoDB table for `users`.
- One Lambda function per CRUD endpoint.
- IAM roles and permissions for each Lambda.
- A real Nest application context inside each Lambda runtime.
- A small adapter layer that reads Nest route metadata during CDK synthesis.

The sample resource exposes:

| Method | Path | Controller Method |
| --- | --- | --- |
| `POST` | `/users` | `UsersController.create` |
| `GET` | `/users` | `UsersController.findAll` |
| `GET` | `/users/{id}` | `UsersController.findOne` |
| `PUT` | `/users/{id}` | `UsersController.replace` |
| `PATCH` | `/users/{id}` | `UsersController.update` |
| `DELETE` | `/users/{id}` | `UsersController.delete` |

## Project Structure

```text
bin/
  app.ts                       CDK app entrypoint
lib/
  crud-api-stack.ts            AWS infrastructure definition
src/
  app/
    app.module.ts              Application module and controller registry
    tokens.ts                  DI tokens
    users/                     Example CRUD resource
  framework/
    routing.ts                 Nest metadata to CDK route discovery
    lambda-adapter.ts          API Gateway event to controller method adapter
  lambda/
    endpoint.ts                Shared Lambda entrypoint
```

## How It Works

Controllers are written with real NestJS decorators from `@nestjs/common`:

```ts
import { Controller, Get, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('{id}')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }
}
```

Nest stores route metadata using `reflect-metadata`. CDK reads Nest's `PATH_METADATA` and `METHOD_METADATA` during synthesis and creates API Gateway routes plus Lambda functions. The Lambda runtime creates a Nest application context with `NestFactory.createApplicationContext(AppModule)`, resolves the controller through Nest's DI container, extracts parameter values from the API Gateway event using Nest's route argument metadata, and calls the controller method.

The important idea is that the Nest controller definition becomes the single source of truth for both runtime behavior and infrastructure generation.

## Commands

Install dependencies:

```sh
npm install
```

Type-check the project:

```sh
npm run build
```

Synthesize the CloudFormation template:

```sh
npm run synth
```

Preview AWS changes:

```sh
npx cdk diff
```

Deploy:

```sh
npm run deploy
```

Destroy:

```sh
npx cdk destroy
```

## Deployment Notes

The stack is currently configured for development use.

- The API is public and has no authentication.
- The DynamoDB table uses `RemovalPolicy.DESTROY`, so deleting the stack deletes the table.
- There is no input validation layer.
- There is no request schema validation in API Gateway.
- There is no rate limiting or WAF configuration.
- Every route gets its own Lambda function.

Before treating this as production infrastructure, add authentication, validation, safer data retention settings, observability, environment-specific configuration, and a more deliberate IAM model.

## Adding Another Resource

1. Create a controller with `@Controller('resource-name')`.
2. Add methods with `@Get`, `@Post`, `@Put`, `@Patch`, or `@Delete`.
3. Create services and repositories as needed.
4. Register providers in `src/app/app.module.ts`.
5. Add the controller to the exported `controllers` array in `src/app/app.module.ts`.

Example:

```ts
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  create(@Body() body: CreatePostDto) {
    return this.posts.create(body);
  }
}
```

Once the controller is registered, CDK can discover its Nest route metadata and create the route infrastructure.

## Why This Is A Terrible Idea For A Normal CRUD API

This project is intentionally named `Nest Abomination` because it bends API Gateway and Lambda around Nest controller metadata just to prove that it can. For a basic CRUD API, this is usually the wrong tradeoff.

The short version: Nest wants to own the HTTP application lifecycle. API Gateway plus Lambda wants small event handlers. This project forces the two models together in a way that keeps much of the complexity of both and loses many of the benefits of each.

### It Uses Nest Without Letting Nest Be Nest

NestJS is valuable because it is a complete, maintained framework with routing, validation, guards, pipes, interceptors, exception filters, testing utilities, lifecycle hooks, documentation, and community patterns.

This project does use real Nest modules, controllers, providers, decorators, exceptions, and dependency injection. The problem is that it does not use Nest in its normal request lifecycle. Instead, it creates a Nest application context inside Lambda and manually invokes controller methods from API Gateway events.

That means some familiar Nest concepts are present, but the normal Nest HTTP adapter pipeline is bypassed. Guards, pipes, interceptors, filters, middleware, request-scoped providers, and validation behavior will not automatically work the same way unless the custom Lambda adapter grows to support them.

That is a bad bargain. The code looks like Nest, but many of the behaviors a Nest developer expects are now conditional on whether this custom adapter remembered to recreate them.

For a CRUD API, that adapter maintenance burden is not justified.

### It Turns A Request Lifecycle Into A Partial Reimplementation

In a normal Nest HTTP app, the request path is handled by Nest and its platform adapter:

```text
HTTP server -> Nest router -> guards -> pipes -> interceptors -> controller -> filters -> response
```

In this project, API Gateway has already routed the request before Nest sees anything:

```text
API Gateway route -> Lambda -> custom adapter -> Nest application context -> manual parameter extraction -> controller method
```

That means the adapter has to decide which pieces of Nest's lifecycle to emulate. Today it handles simple parameter extraction and basic `HttpException` responses. That is enough for a demo, but it is not the Nest request lifecycle.

If the app later needs `ValidationPipe`, auth guards, interceptors for logging, exception filters, request-scoped providers, file uploads, response decorators, custom parameter decorators, or OpenAPI behavior, the adapter becomes a growing compatibility layer. At that point the team is maintaining a small serverless framework disguised as glue code.

### It Has Worse Cold Start Characteristics Than Simple Handlers

Nest's DI container and metadata scanner are useful, but they are not free. Bootstrapping a Nest application context inside Lambda adds startup work:

- Load Nest core.
- Load application modules.
- Reflect on providers and controllers.
- Build the dependency graph.
- Instantiate providers.
- Resolve the target controller.

For a long-running server, this cost is paid once when the process starts. For Lambda, the cost is paid on cold starts. This project also creates one Lambda function per route, which means each route has its own cold start surface. A rarely used endpoint does not benefit from another endpoint already having booted its own container.

Simple CRUD Lambdas can be tiny. This makes them carry Nest.

### It Bloats Every Function Bundle

The Lambda bundle now includes Nest core and supporting dependencies for every endpoint. Even if all six endpoints share the same bundled asset during synthesis, operationally each Lambda function still loads the same framework code in its own execution environment.

That gives you the overhead of a framework with the deployment shape of many small functions.

This is especially awkward because the actual business logic here is small:

```text
parse id -> call service -> read/write DynamoDB -> return JSON
```

Dragging a full Nest application context into that path is not inherently wrong, but it should buy something substantial. For basic CRUD, it mostly buys ceremony.

### It Splits One Logical Nest App Across Many Lambda Functions

Nest apps are normally organized around one running application container. Providers, modules, global configuration, lifecycle hooks, and cross-cutting behavior are easier to reason about when there is one application instance.

This architecture creates a separate Lambda function for every route. Each function starts its own Nest application context and then invokes one controller method. The logical app is shared in source code, but fragmented at runtime.

That fragmentation creates practical problems:

- Logs are spread across many Lambda log groups.
- Metrics are per-function instead of per-app unless extra aggregation is added.
- Environment variables must be consistently applied to every function.
- IAM policies multiply across functions.
- Timeout, memory, tracing, and concurrency settings can drift.
- Any global Nest configuration must be compatible with repeated per-function bootstraps.

This is not impossible to manage, but it is a lot of operational surface area for CRUD.

### It Makes API Gateway And Nest Compete For Routing Ownership

API Gateway already has a route table. Nest also has a route table. This project tries to avoid duplication by deriving API Gateway routes from Nest metadata, which is clever, but it creates a fragile coupling between framework internals and infrastructure synthesis.

CDK now depends on Nest's metadata constants and decorator behavior. If Nest changes internals, if route syntax differs from API Gateway syntax, or if a controller uses a route feature the adapter does not understand, infrastructure generation can break or silently produce the wrong shape.

Examples of features that need careful handling:

- Multiple paths on one controller or handler.
- Wildcards.
- Optional route parameters.
- Versioned routes.
- Global prefixes.
- Host-based routing.
- Custom decorators.
- Route-level metadata consumed by guards or interceptors.

In a direct CDK app, API Gateway routes are infrastructure. In a normal Nest app, Nest routes are application code. Here they are both, and that dual meaning increases the blast radius of a controller change.

### It Encourages The Wrong Abstractions First

The hardest parts of a CRUD API are usually not route decorators. They are:

- Data modeling.
- Validation.
- Authorization.
- Pagination.
- Error semantics.
- Idempotency.
- Observability.
- Backward-compatible API changes.
- Deployment environments.
- Operational alarms.

This architecture spends a lot of design energy making `@Get('{id}')` create a Lambda and API Gateway route. That is interesting infrastructure metaprogramming, but it does not solve the problems that usually make CRUD APIs fail in production.

The project optimizes for authoring aesthetics before proving that the application has enough complexity to need this abstraction.

### It Is Harder To Test Honestly

With a direct Lambda handler, tests can invoke the handler with an API Gateway event. With a normal Nest app, tests can use Nest's testing module and HTTP request tooling.

This project sits between those models. Useful tests need to cover:

- CDK route discovery from Nest metadata.
- API Gateway path compatibility.
- Lambda environment variable dispatch.
- Nest application context creation.
- Parameter extraction from API Gateway events.
- Exception mapping.
- Observable and Promise return values.
- Provider injection.

That is a larger testing burden than either a plain Lambda CRUD API or a normal Nest HTTP API.

### It Makes Future Nest Features Expensive

The first version only needs controllers, services, providers, route params, request bodies, and exceptions. That feels manageable.

The next requests are predictable:

- Add DTO validation.
- Add auth guards.
- Add roles decorators.
- Add request logging.
- Add tracing.
- Add response serialization.
- Add OpenAPI docs.
- Add request-scoped correlation IDs.
- Add global exception filters.
- Add interceptors.

In a normal Nest app, those features use established Nest extension points. In this architecture, each feature has to be checked against the custom Lambda invocation path. Some will work directly, some will partially work, and some will require more adapter code.

This is how a small abstraction becomes a private platform.

### One Lambda Per Method Is Not Automatically Better

One Lambda per endpoint can be useful for isolation, IAM boundaries, deployment granularity, and scaling behavior. It also creates overhead:

- More Lambda functions to inspect.
- More IAM roles and policies.
- More CloudFormation resources.
- More environment configuration.
- More logs spread across log groups.
- More cold start surfaces.
- More deployment noise.

For a small CRUD API, a single Lambda or a small number of grouped Lambdas is often simpler and good enough. If you already want Nest, a single Nest Lambda adapter is usually more coherent than one Nest application context per endpoint.

### It Hides Simple Infrastructure Behind Indirection

A standard CDK CRUD API can be very direct:

```ts
api.addRoutes({
  path: '/users/{id}',
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration('GetUser', getUserLambda),
});
```

That is explicit, searchable, and easy for any CDK developer to understand.

In this project, the route is created indirectly from Nest decorator metadata. That feels elegant until something breaks. Then debugging requires understanding:

- TypeScript decorator emit behavior.
- Nest's internal route metadata constants.
- Custom CDK route discovery.
- CDK synthesis timing.
- Lambda environment variables.
- Runtime controller lookup.
- Nest application context creation.
- API Gateway event mapping.

The abstraction compresses code at the call site, but expands the total system someone must understand.

### It Makes Debugging Harder

With direct Lambda handlers, the execution path is obvious:

```text
API Gateway -> Lambda handler -> repository
```

Here, the path is:

```text
API Gateway -> shared Lambda entrypoint -> env-based controller lookup -> Nest application context -> Nest DI -> parameter metadata mapping -> controller method -> service -> repository
```

That is a lot of machinery for `GET /users/{id}`.

The more layers between the HTTP request and the actual business logic, the more places bugs can hide. For a complex domain this can be worthwhile. For simple CRUD, it is usually ceremony.

### It Creates A Private Adapter Layer You Now Own

The most expensive code in many organizations is not business logic. It is internal platform code that seemed small at first and then became load-bearing.

Once teams depend on this abstraction, future features naturally ask for more Nest lifecycle behavior inside the custom adapter:

- Guards.
- Middleware.
- Validation pipes.
- Exception filters.
- OpenAPI generation.
- Request context.
- Logging decorators.
- Authorization decorators.
- Transaction decorators.
- Testing helpers.

At that point, the team is rebuilding parts of NestJS, Serverless Framework, SST, or another mature tool, but without their ecosystem.

### Over-Abstraction Delays Useful Work

The actual product value in a CRUD API usually comes from things like:

- Correct data modeling.
- Input validation.
- Authorization.
- Error handling.
- Idempotency.
- Pagination.
- Observability.
- Tests.
- Clear deployment environments.

Over-abstracting routing and dependency injection does not solve those problems. It can delay them by spending engineering time on infrastructure elegance before the application has enough complexity to need it.

Good abstractions are extracted from repeated pain. Bad abstractions are invented before the pain exists.

## Better Ways To Combine Nest And AWS

If the goal is to use Nest, use Nest in a way that preserves Nest's lifecycle:

- Run Nest as a normal containerized service on ECS, App Runner, or Kubernetes.
- Run Nest behind a single Lambda adapter where Nest still owns HTTP routing.
- Use API Gateway as a proxy to the Nest app instead of generating one Lambda per controller method.

If the goal is serverless CRUD, keep the handlers simple:

- Use plain Lambda handlers with explicit CDK routes.
- Use API Gateway direct integrations for simple DynamoDB operations.
- Use a small router inside one Lambda if the API is tiny.
- Use SST or Serverless Framework if workflow and deployment ergonomics matter more than Nest conventions.

Trying to get "full Nest conventions" and "one Lambda per endpoint" at the same time creates an awkward middle ground. You do not get the simplicity of serverless functions, and you do not get the full consistency of a normal Nest app.

## When This Approach Might Be Reasonable

This style can make sense only if the goal is specifically to build a platform abstraction where:

- Many teams will write APIs using the same conventions.
- You need strong consistency across dozens of services.
- You are willing to own a framework layer long term.
- You have tests around route discovery, DI, error handling, and synthesis.
- The abstraction provides capabilities that CDK or NestJS alone do not provide.
- You accept that this adapter is now production framework code.

Even then, the framework layer should be treated as a product with versioning, documentation, compatibility guarantees, and automated tests.

## A More Practical Alternative

For a normal CRUD API, prefer one of these:

- Plain CDK with explicit Lambda handlers.
- Real NestJS deployed as one Lambda or a containerized service if Nest conventions matter.
- API Gateway direct integrations for simple DynamoDB operations.
- SST or Serverless Framework if developer workflow is the priority.
- A small Express/Fastify Lambda if the API is tiny and does not need full NestJS.

The boring solution is often the better engineering choice.

## Current Status

This project currently builds and synthesizes successfully. It is deployable as a development stack, but it should be treated as an experiment until authentication, validation, testing, observability, and safer data retention settings are added.

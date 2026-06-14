# Nest Abomination

An intentionally over-abstracted CRUD API scaffold that uses NestJS-style conventions while deploying as AWS Lambda functions behind API Gateway.

This project is useful as an architectural experiment, a learning exercise, or a proof that Nest-like decorators and dependency injection can be made to drive serverless infrastructure. It is not a recommendation for how ordinary CRUD APIs should be built.

## What This Builds

The current stack creates:

- An API Gateway HTTP API.
- A DynamoDB table for `users`.
- One Lambda function per CRUD endpoint.
- IAM roles and permissions for each Lambda.
- A small custom framework layer that mimics parts of NestJS.

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
    decorators.ts              Nest-like decorators
    container.ts               Lightweight dependency injection container
    metadata.ts                Reflect metadata helpers
    routing.ts                 Controller route discovery
    lambda-adapter.ts          API Gateway event to controller method adapter
    errors.ts                  HTTP error primitives
  lambda/
    endpoint.ts                Shared Lambda entrypoint
```

## How It Works

Controllers are written with decorators that look similar to NestJS:

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('{id}')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }
}
```

The decorators store metadata using `reflect-metadata`. CDK reads that metadata during synthesis and creates API Gateway routes plus Lambda functions. The Lambda runtime reads the same application module, resolves the controller through the dependency injection container, extracts parameters from the API Gateway event, and calls the controller method.

The important idea is that the controller definition becomes the single source of truth for both runtime behavior and infrastructure generation.

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

Once the controller is registered, CDK can discover it and create the route infrastructure.

## Why This Is Bad Practice For A Normal CRUD API

This project is intentionally named `Nest Abomination` because it bends serverless infrastructure into a Nest-like shape just to prove that it can. For a basic CRUD API, that is usually the wrong tradeoff.

### It Adds Framework Work Without Framework Maturity

NestJS is valuable because it is a complete, maintained framework with routing, validation, guards, pipes, interceptors, exception filters, testing utilities, lifecycle hooks, documentation, and community patterns.

This project copies the surface-level ergonomics: decorators, modules, controllers, and DI. That creates the feeling of NestJS without the years of hardening behind the real framework. The result is a custom framework that must now be designed, tested, documented, debugged, secured, and maintained.

For a CRUD API, that maintenance burden is rarely justified.

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

In this project, the route is created indirectly from decorator metadata. That feels elegant until something breaks. Then debugging requires understanding:

- TypeScript decorator emit behavior.
- Reflect metadata.
- Custom route discovery.
- CDK synthesis timing.
- Lambda environment variables.
- Runtime controller lookup.
- Custom dependency injection.
- API Gateway event mapping.

The abstraction compresses code at the call site, but expands the total system someone must understand.

### It Makes Debugging Harder

With direct Lambda handlers, the execution path is obvious:

```text
API Gateway -> Lambda handler -> repository
```

Here, the path is:

```text
API Gateway -> shared Lambda entrypoint -> env-based controller lookup -> module container -> constructor metadata -> parameter decorator metadata -> controller method -> service -> repository
```

That is a lot of machinery for `GET /users/{id}`.

The more layers between the HTTP request and the actual business logic, the more places bugs can hide. For a complex domain this can be worthwhile. For simple CRUD, it is usually ceremony.

### It Creates A Private Framework

The most expensive code in many organizations is not business logic. It is internal framework code that seemed small at first and then became load-bearing.

Once teams depend on this abstraction, future features naturally ask for more framework behavior:

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

### One Lambda Per Method Is Not Automatically Better

One Lambda per endpoint can be useful for isolation, IAM boundaries, deployment granularity, and scaling behavior. It also creates overhead:

- More Lambda functions to inspect.
- More IAM roles and policies.
- More CloudFormation resources.
- More environment configuration.
- More logs spread across log groups.
- More cold start surfaces.
- More deployment noise.

For a small CRUD API, a single Lambda or a small number of grouped Lambdas is often simpler and good enough.

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

## When This Approach Might Be Reasonable

This style can make sense if the goal is specifically to build a platform abstraction where:

- Many teams will write APIs using the same conventions.
- You need strong consistency across dozens of services.
- You are willing to own a framework layer long term.
- You have tests around route discovery, DI, error handling, and synthesis.
- The abstraction provides capabilities that CDK or NestJS alone do not provide.

Even then, the framework layer should be treated as a product with versioning, documentation, compatibility guarantees, and automated tests.

## A More Practical Alternative

For a normal CRUD API, prefer one of these:

- Plain CDK with explicit Lambda handlers.
- Real NestJS deployed as a Lambda adapter if Nest conventions matter.
- API Gateway direct integrations for simple DynamoDB operations.
- SST or Serverless Framework if developer workflow is the priority.
- A small Express/Fastify Lambda if the API is tiny and does not need full NestJS.

The boring solution is often the better engineering choice.

## Current Status

This project currently builds and synthesizes successfully. It is deployable as a development stack, but it should be treated as an experiment until authentication, validation, testing, observability, and safer data retention settings are added.

# Nest Abomination

An intentionally over-abstracted CRUD API scaffold that uses Nest-style conventions while deploying as AWS Lambda functions behind API Gateway.

## Shape

- TypeScript with decorators and emitted metadata.
- Lightweight DI container in `src/framework`.
- Nest-like `@Module`, `@Controller`, `@Injectable`, route decorators, and parameter decorators.
- One Lambda per decorated controller endpoint.
- CDK discovers controller route metadata and creates API Gateway routes automatically.
- DynamoDB-backed sample `users` CRUD resource.

## Commands

```sh
npm run build
npm run synth
npm run deploy
```

## Adding A Resource

1. Create a controller with `@Controller('resource-name')`.
2. Add methods with `@Get`, `@Post`, `@Put`, `@Patch`, or `@Delete`.
3. Add services/repositories as providers in `AppModule`.
4. Export the controller in the `controllers` array in `src/app/app.module.ts`.

CDK and Lambda runtime code both consume that same controller list and route metadata.

## Example Route

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

That produces:

- API Gateway route: `GET /users/{id}`
- Dedicated Lambda function
- Runtime dispatch through the DI container

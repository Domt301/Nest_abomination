import { Module } from '../framework';
import { TABLE_NAME, USER_REPOSITORY } from './tokens';
import { DynamoUserRepository } from './users/dynamo-user.repository';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: DynamoUserRepository },
    { provide: TABLE_NAME, useValue: process.env.TABLE_NAME ?? '' },
  ],
})
export class AppModule {}

export const controllers = [UsersController];

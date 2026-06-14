import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY } from '../tokens';
import { CreateUserDto, UpdateUserDto, User, UserRepository } from './user.types';

@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  create(input: CreateUserDto): Promise<User> {
    return this.users.create(input);
  }

  findAll(): Promise<User[]> {
    return this.users.findAll();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, input: UpdateUserDto): Promise<User> {
    const user = await this.users.update(id, input);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  delete(id: string): Promise<void> {
    return this.users.delete(id);
  }
}

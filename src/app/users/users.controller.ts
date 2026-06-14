import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '../../framework';
import { CreateUserDto, UpdateUserDto } from './user.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.users.create(body);
  }

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get('{id}')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Put('{id}')
  replace(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Patch('{id}')
  update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Delete('{id}')
  delete(@Param('id') id: string) {
    return this.users.delete(id);
  }
}

import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '../../framework';
import { TABLE_NAME } from '../tokens';
import { CreateUserDto, UpdateUserDto, User, UserRepository } from './user.types';

@Injectable()
export class DynamoUserRepository implements UserRepository {
  private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  constructor(@Inject(TABLE_NAME) private readonly tableName: string) {}

  async create(input: CreateUserDto): Promise<User> {
    const timestamp = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.client.send(new PutCommand({ TableName: this.tableName, Item: user }));
    return user;
  }

  async findAll(): Promise<User[]> {
    const result = await this.client.send(new ScanCommand({ TableName: this.tableName }));
    return (result.Items ?? []) as User[];
  }

  async findOne(id: string): Promise<User | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
    return result.Item as User | undefined;
  }

  async update(id: string, input: UpdateUserDto): Promise<User | undefined> {
    const current = await this.findOne(id);
    if (!current) {
      return undefined;
    }

    const updated: User = {
      ...current,
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };

    await this.client.send(new PutCommand({ TableName: this.tableName, Item: updated }));
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { id } }));
  }
}

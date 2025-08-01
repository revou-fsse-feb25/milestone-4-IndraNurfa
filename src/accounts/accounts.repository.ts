import { Injectable } from '@nestjs/common';
import { Account, AccountType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { IAccountsRepository } from './accounts.interface';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsRepository implements IAccountsRepository {
  constructor(private prisma: PrismaService) {}

  async create(
    user_id: number,
    account_number: string,
    dto: CreateAccountDto,
  ): Promise<
    Prisma.AccountGetPayload<{
      include: { user: { select: { full_name: true } } };
    }>
  > {
    return await this.prisma.account.create({
      data: {
        user_id,
        account_number,
        account_name: dto.account_name,
        account_type: dto.account_type as AccountType,
      },
      include: {
        user: {
          select: { full_name: true },
        },
      },
    });
  }

  async findByAccountNumber(
    account_number: string,
  ): Promise<Prisma.AccountGetPayload<{
    include: { user: { select: { full_name: true } } };
  }> | null> {
    return await this.prisma.account.findFirst({
      where: { account_number, deleted_at: null },
      include: {
        user: {
          select: { full_name: true },
        },
      },
    });
  }

  async findByUserId(user_id: number): Promise<
    Prisma.AccountGetPayload<{
      include: { user: { select: { full_name: true } } };
    }>[]
  > {
    return await this.prisma.account.findMany({
      where: { user_id, deleted_at: null },
      include: {
        user: {
          select: { full_name: true },
        },
      },
    });
  }

  async findAll(): Promise<
    Prisma.AccountGetPayload<{
      include: { user: { select: { full_name: true } } };
    }>[]
  > {
    return await this.prisma.account.findMany({
      where: { deleted_at: null },
      include: {
        user: {
          select: { full_name: true },
        },
      },
    });
  }

  async updateAccount(
    account_number: string,
    user_id: number,
    dto: UpdateAccountDto,
  ): Promise<Account> {
    return await this.prisma.account.update({
      where: { user_id, account_number, deleted_at: null },
      data: {
        account_name: dto.account_name,
        account_type: dto.account_type as AccountType,
      },
    });
  }

  async deleteAccount(account_number: string): Promise<Account> {
    return await this.prisma.account.update({
      where: { account_number },
      data: { deleted_at: new Date() },
    });
  }

  async updateBalance(
    tx: Prisma.TransactionClient,
    account_number: string,
    amount: Prisma.Decimal | number,
  ): Promise<Account> {
    return await tx.account.update({
      where: { account_number, deleted_at: null },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  }
}

import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserSession } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { JwtHelpers } from '../common/utils/jwt-helpers';
import { ISessionService } from 'src/session/session.interface';
import { UsersService } from '../users/users.service';
import { IAuthService } from './auth.interface';
import { jwtConstants } from './constant/constant';
import { LoginDto, RegisterDto } from './dto/req-auth.dto';
import { ResponseRegisterDto } from './dto/resp-auth.dto';
import { TokenPayload } from './types/auth';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly JwtHelpers: JwtHelpers,
    @Inject('ISessionService')
    private readonly sessionService: ISessionService,
  ) {}

  async register(dto: RegisterDto): Promise<ResponseRegisterDto> {
    const hash = await bcrypt.hash(dto.password, 10);
    const dob = new Date(dto.dob);

    dto.password = hash;
    dto.dob = dob;

    return await this.userService.create(dto);
  }

  async login(dto: LoginDto) {
    const existingUser = await this.userService.findByUsername(dto.username);

    if (!existingUser) {
      throw new BadRequestException('username not found');
    }

    const plaintextPassword = dto.password;
    const hashFromDb = existingUser.password;

    const isPasswordMatching = await bcrypt.compare(
      plaintextPassword,
      hashFromDb,
    );

    if (!isPasswordMatching) {
      throw new BadRequestException('username or password is invalid.');
    }

    const uuid = randomUUID();

    const [access_token, refresh_token] = await Promise.all([
      this.JwtHelpers.generate(
        existingUser.id,
        existingUser.username,
        existingUser.full_name,
        existingUser.role.name,
        jwtConstants.access_token_expires,
        uuid,
      ),
      this.JwtHelpers.generate(
        existingUser.id,
        existingUser.username,
        existingUser.full_name,
        existingUser.role.name,
        jwtConstants.refresh_token_expires,
        uuid,
      ),
    ]);

    const [hash_token, hash_refresh_token] = await Promise.all([
      await bcrypt.hash(access_token, 10),
      await bcrypt.hash(refresh_token, 10),
    ]);

    await this.sessionService.create({
      user_id: existingUser.id,
      jti: uuid,
      token: hash_token,
      refresh_token: hash_refresh_token,
      token_expired: new Date(Date.now() + 15 * 60 * 1000),
      refresh_token_expired: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      ...existingUser,
      access_token: access_token,
      refresh_token: refresh_token,
    };
  }

  async refreshToken(data: TokenPayload): Promise<string> {
    const { sub, username, full_name, role, jti } = data;

    const access_token = await this.JwtHelpers.generate(
      sub,
      username,
      full_name,
      role,
      jwtConstants.access_token_expires,
      jti,
    );

    const hashToken = await bcrypt.hash(access_token, 10);

    const updateSession = await this.sessionService.updateToken(jti, hashToken);

    if (!updateSession) {
      throw new InternalServerErrorException('Failed to update access token');
    }

    return access_token;
  }

  async revokeToken(jti: string): Promise<UserSession> {
    return await this.sessionService.revokeToken(jti);
  }
}

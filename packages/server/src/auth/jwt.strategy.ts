import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-http-bearer';

const COGNITO_USERPOOL_ID = process.env.COGNITO_USERPOOL_ID!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USERPOOL_ID,
  tokenUse: 'access',
  clientId: COGNITO_CLIENT_ID,
});

export interface Claim {
  sub: string;
  iss: string;
  client_id: string;
  origin_jti: string;
  event_id: string;
  token_use: string;
  scope: string;
  auth_time: number;
  exp: number;
  iat: number;
  jti: string;
  username: string;
}

export const jwtStrategy = 'jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, jwtStrategy) {
  constructor() {
    super();
  }

  public async validate(bearerToken: string): Promise<Claim> {
    try {
      const payload = await verifier.verify(bearerToken);

      // TODO: validate zod
      return payload as any as Claim;
    } catch (_e) {
      throw new UnauthorizedException();
    }
  }
}

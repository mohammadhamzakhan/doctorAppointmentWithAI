import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";


@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access'){

    constructor(configService: ConfigService){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
            ignoreExpiration: false,
        });

        
    }
    validate(payload: any){
        return payload;
    }
}
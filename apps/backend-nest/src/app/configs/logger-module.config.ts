import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LoggerModuleOptionsFactory,
  LogLevel,
  LogMode,
} from 'nestjs-backend-common';

@Injectable()
export class LoggerModuleConfig implements LoggerModuleOptionsFactory {
  constructor(private readonly configService: ConfigService) {}
  create() {
    return {
      logMode: this.configService.getOrThrow<LogMode>('LOG_MODE'),
      logLevel: this.configService.getOrThrow<LogLevel>('LOG_LEVEL'),
    };
  }
}

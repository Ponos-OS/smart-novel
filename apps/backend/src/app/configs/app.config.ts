import { registerAs } from '@nestjs/config';
import { Transform } from 'class-transformer';
import {
  isEmpty,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { type StringValue } from 'ms';
import {
  type LogLevel,
  type LogMode,
  validateEnvs,
} from 'nestjs-backend-common';

import { AppConfig } from '../interfaces';

declare global {
  namespace NodeJS {
    interface ProcessEnv extends AppConfig {}
  }
}

export const appConfigs = registerAs('appConfigs', (): AppConfig => {
  const validatedEnvs = validateEnvs(
    process.env,
    EnvironmentVariables,
  );

  return validatedEnvs;
});

class EnvironmentVariables implements AppConfig {
  @IsInt()
  @IsPositive()
  EXPLAIN_CONTEXT_CHAR_SIZE: number;

  @IsInt()
  PORT: number;

  @Transform(({ value }) =>
    value
      .split(',')
      .map((origin: string) =>
        isEmpty(origin.trim()) ? null : origin.trim(),
      )
      .filter(Boolean),
  )
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  CORS_ALLOWED_ORIGINS: string[];

  @IsIn(['development', 'production', 'test'])
  NODE_ENV: AppConfig['NODE_ENV'];

  @IsIn(['PLAIN_TEXT', 'JSON'])
  LOG_MODE: LogMode;

  @IsIn([
    'error', // 0
    'warn', // 1
    'info', // 2
    'http', // 3
    'verbose', // 4
    'debug', // 5
    'silly', // 6
  ])
  LOG_LEVEL: LogLevel;

  @IsNotEmpty()
  @IsString()
  BEATRICE_URL: string;

  @IsNotEmpty()
  @IsString()
  BEATRICE_TIMEOUT: StringValue;

  @IsNotEmpty()
  @IsString()
  BEATRICE_DEFAULT_VOICE: string;

  @IsNotEmpty()
  @IsString()
  BACKEND_INTERNAL_URL: string;

  @IsNotEmpty()
  @IsString()
  LLM_CACHE_TTL: StringValue;

  @IsNotEmpty()
  @IsString()
  REDIS_URL: string;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  OBJECT_STORAGE_REGION: string;

  @IsOptional()
  @IsString()
  OBJECT_STORAGE_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OBJECT_STORAGE_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  OBJECT_STORAGE_SECRET_KEY?: string;

  @IsNotEmpty()
  @IsString()
  OBJECT_STORAGE_BUCKET: string;

  @IsNotEmpty()
  @IsString()
  OBJECT_STORAGE_PUBLIC_URL: string;

  @IsNotEmpty()
  @IsString()
  ZITADEL_ISSUER_URL: string;

  @IsOptional()
  @IsString()
  ZITADEL_INTERNAL_URL?: string;

  @IsOptional()
  @IsString()
  ZITADEL_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  ZITADEL_CLIENT_ID_FILE?: string;

  @IsOptional()
  @IsString()
  ZITADEL_PAT?: string;

  @IsOptional()
  @IsString()
  ZITADEL_PAT_FILE?: string;

  @IsNotEmpty()
  @IsString()
  ZITADEL_DOMAIN: string;

  @IsOptional()
  @IsString()
  ZITADEL_CLIENT_SECRET?: string;

  @IsNotEmpty()
  @IsString()
  ZITADEL_CALLBACK_URL: string;

  @IsOptional()
  @IsString()
  ZITADEL_POST_LOGIN_URL?: string;

  @IsNotEmpty()
  @IsString()
  ZITADEL_POST_LOGOUT_URL: string;

  @IsNotEmpty()
  @IsString()
  SESSION_SECRET: string;

  @IsInt()
  SESSION_DURATION: number;

  @IsString()
  SERVICE_NAME = 'smart-novel-backend';

  @IsOptional()
  @IsIn(['true', 'false'])
  OTEL_ENABLED?: 'true' | 'false';

  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OTEL_TRACES_SAMPLER?: string;

  @IsOptional()
  @IsString()
  OTEL_TRACES_SAMPLER_ARG?: string;

  @IsOptional()
  @IsString()
  OTEL_BATCH_EXPORT_TIMEOUT_MS?: string;

  @IsOptional()
  @IsString()
  OTEL_BATCH_FLUSH_INTERVAL_MS?: string;

  @IsOptional()
  @IsString()
  OTEL_BATCH_SPANS_PER_EXPORT?: string;

  @IsOptional()
  @IsString()
  OTEL_BATCH_MAX_PENDING_SPANS?: string;
}

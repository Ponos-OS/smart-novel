import './instrumentation.js'; // 👈 MUST be the very first import. Starts the OpenTelemetry.

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { appConfigs, AppModule } from './app';

const JSON_BODY_LIMIT = '1mb';

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(AppModule);
  const { PORT, CORS_ALLOWED_ORIGINS } = app.get<
    ConfigType<typeof appConfigs>
  >(appConfigs.KEY);

  // A license assistant request carries the whole conversation and the draft; express' default of 100kb is too small for them.
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(cookieParser());

  app.enableCors({
    origin: CORS_ALLOWED_ORIGINS,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(PORT);

  Logger.log(
    `🚀 Application is running on: http://localhost:${PORT}/graphql`,
  );
}

bootstrap();

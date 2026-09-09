import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import depthLimit from 'graphql-depth-limit';
import { LoggerModule } from 'nestjs-backend-common';
import { ClsModule } from 'nestjs-cls';
import { OpenTelemetryModule } from 'nestjs-otel';

import {
  AuthModule,
  BackgroundRunnerModule,
  LlmModule,
  NovelModule,
  ObjectStorageModule,
  PrismaModule,
  RedisModule,
  TtsCallbacksModule,
} from '../modules';
import {
  graphqlSpanRenamePlugin,
  TraceIdInterceptor,
} from '../shared';
import { AppResolver } from './app.resolver';
import {
  appConfigs,
  AuthModuleConfig,
  LoggerModuleConfig,
  ObjectStorageModuleConfig,
  RedisModuleConfig,
} from './configs';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfigs],
    }),
    LoggerModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useClass: LoggerModuleConfig,
    }),
    RedisModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useClass: RedisModuleConfig,
    }),
    ObjectStorageModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useClass: ObjectStorageModuleConfig,
    }),
    AuthModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useClass: AuthModuleConfig,
    }),
    PrismaModule,
    OpenTelemetryModule.forRoot(),
    BackgroundRunnerModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: false,
      plugins: [
        ApolloServerPluginLandingPageLocalDefault(),
        graphqlSpanRenamePlugin(),
      ],
      validationRules: [depthLimit(7)],
      subscriptions: {
        'graphql-ws': true,
      },
    }),
    NovelModule,
    LlmModule,
    TtsCallbacksModule,
  ],
  providers: [
    AppResolver,
    { provide: APP_INTERCEPTOR, useClass: TraceIdInterceptor },
  ],
})
export class AppModule {}

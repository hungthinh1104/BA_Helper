import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { getRuntimeConfig, validateRuntimeConfig } from './bootstrap/runtime-config';

const bootstrap = async () => {
	const config = getRuntimeConfig();
	validateRuntimeConfig(config);

	const app = await NestFactory.create(AppModule, { cors: false });
	configureApp(app, config);

	await app.listen(config.port);
};

void bootstrap();

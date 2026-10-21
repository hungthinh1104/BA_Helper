import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const bootstrap = async () => {
	const app = await NestFactory.createApplicationContext(AppModule);
	await app.init();
	Logger.log(JSON.stringify({ event: 'WORKER_READY' }), 'Bootstrap');
};

bootstrap().catch((err) => {
	console.error('Worker failed to start', err);
	process.exit(1);
});

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const bootstrap = async () => {
	const app = await NestFactory.createApplicationContext(AppModule);
	await app.init();
};

bootstrap().catch((err) => {
	console.error('Worker failed to start', err);
	process.exit(1);
});

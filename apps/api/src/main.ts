import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { getRuntimeConfig, validateRuntimeConfig } from './bootstrap/runtime-config';

const bootstrap = async () => {
	const config = getRuntimeConfig();
	validateRuntimeConfig(config);

	const app = await NestFactory.create(AppModule, { cors: false });
	configureApp(app, config);

	const swaggerConfig = new DocumentBuilder()
		.setTitle('BA Helper API')
		.setDescription('The BA Helper API documentation')
		.setVersion(config.apiVersion)
		.build();
	const document = SwaggerModule.createDocument(app, swaggerConfig);

	app.use(
		'/api/docs',
		apiReference({
			spec: {
				content: document,
			},
		}),
	);

	await app.listen(config.port);
};

void bootstrap();

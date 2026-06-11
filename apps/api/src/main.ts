import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './shared/app-exception.filter';

const bootstrap = async () => {
	const app = await NestFactory.create(AppModule, { cors: true });
	app.useGlobalFilters(new AppExceptionFilter());

	const config = new DocumentBuilder()
		.setTitle('BA Helper API')
		.setDescription('The BA Helper API documentation')
		.setVersion('1.0')
		.build();
	const document = SwaggerModule.createDocument(app, config);

	app.use(
		'/api/docs',
		apiReference({
			spec: {
				content: document,
			},
		}),
	);

	await app.listen(3000);
};

void bootstrap();

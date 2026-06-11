"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_exception_filter_1 = require("./shared/app-exception.filter");
const bootstrap = async () => {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: true });
    app.useGlobalFilters(new app_exception_filter_1.AppExceptionFilter());
    await app.listen(3000);
};
void bootstrap();

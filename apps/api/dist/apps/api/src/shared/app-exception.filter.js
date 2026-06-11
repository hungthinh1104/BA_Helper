"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AppExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const app_error_1 = require("./app-error");
let AppExceptionFilter = AppExceptionFilter_1 = class AppExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(AppExceptionFilter_1.name);
    }
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        const status = AppExceptionFilter_1.mapStatus(exception.code);
        this.logger.warn({
            code: exception.code,
            message: exception.message,
            status,
        });
        response.status(status).json({
            code: exception.code,
            message: exception.message,
        });
    }
    static mapStatus(code) {
        switch (code) {
            case 'INVALID_PROJECT_NAME':
            case 'INVALID_REPOSITORY_URL':
            case 'INVALID_REPOSITORY_REF':
            case 'INVALID_REQUIREMENT_INPUT':
            case 'REQUEST_KEY_MISMATCH':
            case 'FINALIZE_REQUIRES_REVIEW_ACK':
            case 'REVIEW_NOT_ALLOWED':
                return common_1.HttpStatus.BAD_REQUEST;
            case 'PROJECT_NOT_FOUND':
            case 'REPOSITORY_NOT_FOUND':
            case 'SCAN_JOB_NOT_FOUND':
            case 'REQUIREMENT_NOT_FOUND':
            case 'REQUIREMENT_REVISION_NOT_FOUND':
            case 'SNAPSHOT_NOT_FOUND':
            case 'SOURCE_TARGET_NOT_FOUND':
            case 'IMPACT_ANALYSIS_NOT_FOUND':
                return common_1.HttpStatus.NOT_FOUND;
            default:
                return common_1.HttpStatus.BAD_REQUEST;
        }
    }
};
exports.AppExceptionFilter = AppExceptionFilter;
exports.AppExceptionFilter = AppExceptionFilter = AppExceptionFilter_1 = __decorate([
    (0, common_1.Catch)(app_error_1.AppError)
], AppExceptionFilter);

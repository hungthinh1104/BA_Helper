import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppError } from './app-error';

@Catch(AppError)
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: AppError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = AppExceptionFilter.mapStatus(exception.code);

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

  private static mapStatus(code: AppError['code']): number {
    switch (code) {
      case 'INVALID_PROJECT_NAME':
      case 'INVALID_REPOSITORY_URL':
      case 'INVALID_REPOSITORY_REF':
      case 'INVALID_REQUIREMENT_INPUT':
      case 'REQUEST_KEY_MISMATCH':
      case 'FINALIZE_REQUIRES_REVIEW_ACK':
      case 'REVIEW_NOT_ALLOWED':
        return HttpStatus.BAD_REQUEST;
      case 'PROJECT_NOT_FOUND':
      case 'REPOSITORY_NOT_FOUND':
      case 'SCAN_JOB_NOT_FOUND':
      case 'REQUIREMENT_NOT_FOUND':
      case 'REQUIREMENT_REVISION_NOT_FOUND':
      case 'SNAPSHOT_NOT_FOUND':
      case 'SOURCE_TARGET_NOT_FOUND':
      case 'IMPACT_ANALYSIS_NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}

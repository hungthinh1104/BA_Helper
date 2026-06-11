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

    this.logger.warn(
      `AppError [${exception.code}]: ${exception.message} (status: ${status})`
    );

    response.status(status).json({
      code: exception.code,
      message: exception.message,
    });
  }

  private static mapStatus(code: AppError['code']): number {
    switch (code) {
      case 'INVALID_PROJECT_NAME':
      case 'WORKSPACE_MODE_UNSUPPORTED':
      case 'INVALID_REPOSITORY_URL':
      case 'INVALID_REPOSITORY_REF':
      case 'INVALID_REQUIREMENT_INPUT':
      case 'FINALIZE_REQUIRES_REVIEW_ACK':
      case 'REVIEW_NOT_ALLOWED':
      case 'INPUT_PROJECT_MISMATCH':
      case 'REQUIREMENT_REVISION_NOT_READY':
      case 'UNSUPPORTED_DOMAIN':
      case 'UNSUPPORTED_FRAMEWORK':
      case 'REPORT_NOT_EXPORTABLE':
        return HttpStatus.BAD_REQUEST;
      case 'REPO_LIMIT_EXCEEDED':
        return HttpStatus.PAYLOAD_TOO_LARGE;
      case 'CLONE_FAILED':
        return HttpStatus.BAD_GATEWAY;
      case 'SECURITY_RISK_BLOCKED':
      case 'DOCUMENT_EXPORT_FORBIDDEN':
        return HttpStatus.FORBIDDEN;
      case 'DOCUMENT_EXPORT_UNAUTHENTICATED':
        return HttpStatus.UNAUTHORIZED;
      case 'PROJECT_NOT_FOUND':
      case 'PROJECT_MEMBER_NOT_FOUND':
      case 'PROJECT_MEMBER_USER_NOT_FOUND':
      case 'REPOSITORY_NOT_FOUND':
      case 'SCAN_JOB_NOT_FOUND':
      case 'REQUIREMENT_NOT_FOUND':
      case 'REQUIREMENT_REVISION_NOT_FOUND':
      case 'SNAPSHOT_NOT_FOUND':
      case 'SOURCE_TARGET_NOT_FOUND':
      case 'IMPACT_ANALYSIS_NOT_FOUND':
      case 'APPROVED_REPORT_NOT_FOUND':
        return HttpStatus.NOT_FOUND;
      case 'REQUEST_KEY_MISMATCH':
      case 'LAST_PROJECT_OWNER_REQUIRED':
      case 'INVALID_STATE_TRANSITION':
      case 'ANALYSIS_STALE':
      case 'REPORT_EXPORT_BLOCKED_STALE':
        return HttpStatus.CONFLICT;
      case 'PDF_RENDER_FAILED':
        return HttpStatus.BAD_GATEWAY;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}

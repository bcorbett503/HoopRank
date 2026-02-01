import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter to handle all unhandled errors.
 * Provides consistent JSON error responses and logging.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'Unknown error';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
                error = exception.name;
            } else if (typeof exceptionResponse === 'object') {
                message = (exceptionResponse as any).message || exception.message;
                error = (exceptionResponse as any).error || exception.name;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            error = exception.name;

            // Log unexpected errors with stack trace
            this.logger.error(
                `Unexpected error: ${exception.message}`,
                exception.stack,
            );
        }

        // Log all 5xx errors
        if (status >= 500) {
            this.logger.error(
                `[${request.method}] ${request.url} - ${status}: ${message}`,
                exception instanceof Error ? exception.stack : undefined,
            );
        } else if (status >= 400) {
            // Log 4xx as warnings
            this.logger.warn(
                `[${request.method}] ${request.url} - ${status}: ${message}`,
            );
        }

        response.status(status).json({
            success: false,
            statusCode: status,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}

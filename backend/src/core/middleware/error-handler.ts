import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { AppError, ERROR_CODES } from '../errors/app-error.ts';
import { errorBody } from '../http/response.ts';

interface HttpLikeError {
  readonly statusCode?: number;
  readonly message: string;
}

function mapZodIssues(error: ZodError): { field: string; issue: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    issue: issue.message,
  }));
}

function toHttpLikeError(error: unknown): HttpLikeError {
  if (error instanceof Error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    return { statusCode, message: error.message };
  }
  return { message: 'Terjadi kesalahan internal' };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send(errorBody(ERROR_CODES.NOT_FOUND, `Rute ${request.method} ${request.url} tidak ditemukan`));
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(errorBody(error.code, error.message, error.details));
      return;
    }

    if (error instanceof ZodError) {
      reply
        .status(400)
        .send(errorBody(ERROR_CODES.VALIDATION_ERROR, 'Validasi input gagal', mapZodIssues(error)));
      return;
    }

    const httpError = toHttpLikeError(error);
    const statusCode = httpError.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error({ err: error }, 'Unhandled error');
      reply.status(500).send(errorBody(ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan internal'));
      return;
    }

    reply.status(statusCode).send(errorBody(ERROR_CODES.VALIDATION_ERROR, httpError.message));
  });
}

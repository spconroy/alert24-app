import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

/**
 * Standardized API error responses
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

/**
 * Common API response formats
 */
export const ApiResponse = {
  success: (data, message = null, statusCode = 200) => {
    const response = { success: true, ...data };
    if (message) response.message = message;
    return NextResponse.json(response, { status: statusCode });
  },

  error: (error, statusCode = 500) => {
    const response = {
      success: false,
      error: error.message || error,
      timestamp: new Date().toISOString(),
    };

    // Add additional error details for development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      response.stack = error.stack;
    }

    // Add database error details if available
    if (error.code) response.code = error.code;
    if (error.details) response.details = error.details;
    if (error.hint) response.hint = error.hint;

    return NextResponse.json(response, { status: statusCode });
  },

  unauthorized: (message = 'Unauthorized access') => {
    return ApiResponse.error(new ApiError(message, 401), 401);
  },

  forbidden: (message = 'Access denied - insufficient permissions') => {
    return ApiResponse.error(new ApiError(message, 403), 403);
  },

  notFound: (resource = 'Resource') => {
    return ApiResponse.error(new ApiError(`${resource} not found`, 404), 404);
  },

  badRequest: (message = 'Invalid request data') => {
    return ApiResponse.error(new ApiError(message, 400), 400);
  },

  conflict: (message = 'Resource conflict') => {
    return ApiResponse.error(new ApiError(message, 409), 409);
  },
};

/**
 * Input validation utilities
 */
export const Validator = {
  required: (fields, data) => {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new ApiError(`Missing required fields: ${missing.join(', ')}`, 400);
    }
  },

  email: email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError('Invalid email format', 400);
    }
  },

  uuid: (value, fieldName = 'ID') => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new ApiError(`Invalid ${fieldName} format`, 400);
    }
  },

  slug: slug => {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      throw new ApiError(
        'Slug must contain only lowercase letters, numbers, and hyphens',
        400
      );
    }
  },

  enum: (value, allowedValues, fieldName = 'field') => {
    if (!allowedValues.includes(value)) {
      throw new ApiError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        400
      );
    }
  },

  sanitizeHtml: text => {
    if (!text) return text;
    // Basic HTML sanitization - remove script tags and potentially dangerous content
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  },
};

/**
 * Authentication and authorization utilities
 */
export const Auth = {
  async requireAuth(authOptions) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      throw new ApiError('Authentication required', 401);
    }
    return session;
  },

  async requireUser(db, email) {
    const user = await db.getUserByEmail(email);
    if (!user) {
      throw new ApiError('User not found', 404);
    }
    return user;
  },

  async requireOrganizationMember(
    db,
    organizationId,
    userId,
    requiredRoles = ['owner', 'admin', 'member']
  ) {
    const membership = await db.getOrganizationMember(organizationId, userId);
    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ApiError(
        `Access denied - requires role: ${requiredRoles.join(' or ')}`,
        403
      );
    }
    return membership;
  },
};

/**
 * Database error handling utilities
 */
export const DbErrorHandler = {
  handle: error => {
    console.error('Database error:', error);

    // Handle specific PostgreSQL error codes
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      throw new ApiError('Resource already exists', 409);
    }

    if (error.code === '23503' || error.message?.includes('foreign key')) {
      throw new ApiError('Referenced resource not found', 400);
    }

    if (error.code === '23514' || error.message?.includes('check constraint')) {
      throw new ApiError('Invalid data format', 400);
    }

    if (error.message?.includes('does not exist')) {
      throw new ApiError('Resource not found', 404);
    }

    // Handle Supabase-specific errors
    if (error.message?.includes('Row Level Security')) {
      throw new ApiError('Access denied', 403);
    }

    // Generic database error
    throw new ApiError(
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Database operation failed',
      500
    );
  },
};

/**
 * Async error wrapper for API routes
 */
export const withErrorHandler = handler => {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(error, error.statusCode);
      }

      // Handle database errors
      if (error.code || error.message?.includes('database')) {
        try {
          DbErrorHandler.handle(error);
        } catch (dbError) {
          return ApiResponse.error(dbError, dbError.statusCode);
        }
      }

      // Handle unexpected errors
      console.error('Unexpected API error:', error);
      return ApiResponse.error(
        new ApiError('An unexpected error occurred', 500),
        500
      );
    }
  };
};

/**
 * Request body parser with validation
 */
export const parseRequestBody = async (request, requiredFields = []) => {
  try {
    const body = await request.json();
    if (requiredFields.length > 0) {
      Validator.required(requiredFields, body);
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Invalid JSON in request body', 400);
  }
};

/**
 * URL parameter validation
 */
export const validateParams = (params, validations = {}) => {
  Object.entries(validations).forEach(([key, validation]) => {
    const value = params[key];
    if (!value) {
      throw new ApiError(`Missing parameter: ${key}`, 400);
    }
    if (validation === 'uuid') {
      Validator.uuid(value, key);
    }
  });
};

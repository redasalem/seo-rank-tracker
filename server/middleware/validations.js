import { z } from "zod";
import xss from "xss";

// Removed safeString. We will apply xss in the middleware.

// ════════════════════════════════════════════════════════════════════════════════
// ─── Validation Middleware ──────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Creates an Express middleware that validates the request data using a Zod schema.
 * @param {z.ZodSchema} schema - The Zod schema to validate against.
 * @param {"body" | "params" | "query"} source - Where to read data from (default: "body").
 */
export const validate = (schema, source = "body") => {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            const errors = result.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }));

            return res.status(400).json({
                message: errors[0]?.message || "Validation failed",
                errors
            });
        }

        // Replace the source data with the parsed data, and sanitize strings
        const cleanData = (data) => {
            if (typeof data === 'string') return xss(data);
            if (Array.isArray(data)) return data.map(cleanData);
            if (typeof data === 'object' && data !== null) {
                const cleaned = {};
                for (const key in data) {
                    cleaned[key] = cleanData(data[key]);
                }
                return cleaned;
            }
            return data;
        };

        const sanitized = cleanData(result.data);
        
        try {
            // Try standard assignment (works in local Express)
            req[source] = sanitized;
        } catch (e) {
            // Vercel serverless environments define req.body / req.query as read-only getters.
            // Fallback: clear the existing object and mutate it in place.
            if (typeof req[source] === 'object' && req[source] !== null) {
                for (const key in req[source]) {
                    delete req[source][key];
                }
                Object.assign(req[source], sanitized);
            }
        }
        
        next();
    };
};

// ════════════════════════════════════════════════════════════════════════════════
// ─── Auth Schemas ───────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

export const requestRegistrationSchema = z.object({
    email: z.string({ required_error: "Email is required" })
        .trim()
        .email("Please provide a valid email address")
        .toLowerCase(),
});

export const completeRegistrationSchema = z.object({
    token: z.string({ required_error: "Token is required" }).trim(),
    name: z.string({ required_error: "Name is required" })
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(50, "Name must be at most 50 characters"),
    password: z.string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[a-z]/, "Must contain at least one lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Must contain at least one special character")
        .max(128, "Password must be at most 128 characters"),
});

export const loginSchema = z.object({
    email: z.string({ required_error: "Email is required" })
        .trim()
        .email("Please provide a valid email address")
        .toLowerCase(),
    password: z.string({ required_error: "Password is required" })
        .min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
    name: z.string({ required_error: "Name is required" })
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(50, "Name must be at most 50 characters"),
    email: z.string({ required_error: "Email is required" })
        .trim()
        .email("Please provide a valid email address")
        .toLowerCase(),
    reportFrequency: z.enum(["weekly", "monthly", "off"]).optional(),
    language: z.enum(["en", "ar"]).optional(),
});

export const updatePasswordSchema = z.object({
    currentPassword: z.string({ required_error: "Current password is required" })
        .min(1, "Current password is required"),
    newPassword: z.string({ required_error: "New password is required" })
        .min(8, "New password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[a-z]/, "Must contain at least one lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Must contain at least one special character")
        .max(128, "New password must be at most 128 characters"),
});

export const forgotPasswordSchema = z.object({
    email: z.string({ required_error: "Email is required" })
        .trim()
        .email("Please provide a valid email address")
        .toLowerCase(),
});

export const resetPasswordSchema = z.object({
    password: z.string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[a-z]/, "Must contain at least one lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Must contain at least one special character")
        .max(128, "Password must be at most 128 characters"),
});

// ════════════════════════════════════════════════════════════════════════════════
// ─── Rank / Keyword Schemas ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

export const addKeywordSchema = z.object({
    keyword: z.string({ required_error: "Keyword is required" })
        .trim()
        .min(2, "Keyword must be at least 2 characters")
        .max(100, "Keyword must be at most 100 characters"),
    url: z.string({ required_error: "URL is required" })
        .trim()
        .min(3, "URL is too short"),
    country: z.string({ required_error: "Country is required" })
        .trim()
        .min(2, "Country code must be at least 2 characters")
        .max(5, "Country code must be at most 5 characters"),
    domain: z.string()
        .trim()
        .optional(),
});

// ════════════════════════════════════════════════════════════════════════════════
// ─── Analysis Schemas ───────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

export const startAnalysisSchema = z.object({
    url: z.string({ required_error: "URL is required" })
        .trim()
        .min(5, "URL is too short"),
});

// ════════════════════════════════════════════════════════════════════════════════
// ─── Common Schemas ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════

export const mongoIdSchema = z.object({
    id: z.string({ required_error: "ID is required" })
        .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID format"),
});

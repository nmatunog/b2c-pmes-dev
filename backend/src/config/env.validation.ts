import * as Joi from "joi";

/** Loaded from process.env before the app boots; fails fast on misconfiguration. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required().messages({
    "any.required": "DATABASE_URL is required (PostgreSQL connection string)",
  }),
  /** Same DB as DATABASE_URL for local dev; on Neon use the direct (non-pooled) hostname for `prisma migrate`. */
  DIRECT_URL: Joi.string().required().messages({
    "any.required": "DIRECT_URL is required — use same value as DATABASE_URL locally; Neon provides a separate direct URL",
  }),
  /**
   * TTS backend: `noop` (no paid calls), `gemini`, `openai`, `grok` (xAI Grok TTS at api.x.ai).
   */
  AI_PROVIDER: Joi.string().valid("noop", "gemini", "openai", "grok").default("noop"),
  GEMINI_API_KEY: Joi.string().allow(""),
  GEMINI_TTS_MODEL: Joi.string().allow(""),
  OPENAI_API_KEY: Joi.string().allow(""),
  OPENAI_TTS_MODEL: Joi.string().allow(""),
  /** xAI / Grok — https://console.x.ai */
  XAI_API_KEY: Joi.string().allow(""),

  /** HS256 secret for staff JWTs (POST /auth/admin/login, /auth/staff/*). */
  ADMIN_JWT_SECRET: Joi.string().min(32).required(),
})
  .custom((value, helpers) => {
    const v = value as {
      AI_PROVIDER?: string;
      GEMINI_API_KEY?: string;
      OPENAI_API_KEY?: string;
      XAI_API_KEY?: string;
    };
    const p = v.AI_PROVIDER;
    if (p === "gemini" && !String(v.GEMINI_API_KEY ?? "").trim()) {
      return helpers.error("any.custom", {
        message: "GEMINI_API_KEY is required when AI_PROVIDER=gemini (or use noop / openai / grok)",
      });
    }
    if (p === "openai" && !String(v.OPENAI_API_KEY ?? "").trim()) {
      return helpers.error("any.custom", {
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }
    if (p === "grok" && !String(v.XAI_API_KEY ?? "").trim()) {
      return helpers.error("any.custom", {
        message: "XAI_API_KEY is required when AI_PROVIDER=grok",
      });
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  });

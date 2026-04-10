import * as Joi from "joi";

/** Loaded from process.env before the app boots; fails fast on misconfiguration. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required().messages({
    "any.required": "DATABASE_URL is required (PostgreSQL connection string)",
  }),
  /** `noop` = no Gemini calls (default for cheap local dev). Set `gemini` in env when you have a key. */
  AI_PROVIDER: Joi.string().valid("gemini", "noop").default("noop"),
  GEMINI_API_KEY: Joi.string().allow(""),
  GEMINI_TTS_MODEL: Joi.string().allow(""),
})
  .custom((value, helpers) => {
    const v = value as { AI_PROVIDER?: string; GEMINI_API_KEY?: string };
    if (v.AI_PROVIDER === "gemini" && !String(v.GEMINI_API_KEY ?? "").trim()) {
      return helpers.error("any.custom", {
        message: "GEMINI_API_KEY is required when AI_PROVIDER=gemini (or set AI_PROVIDER=noop)",
      });
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  });

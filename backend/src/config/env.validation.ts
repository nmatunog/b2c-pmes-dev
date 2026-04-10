import * as Joi from "joi";

/** Loaded from process.env before the app boots; fails fast on misconfiguration. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required().messages({
    "any.required": "DATABASE_URL is required (PostgreSQL connection string)",
  }),
});

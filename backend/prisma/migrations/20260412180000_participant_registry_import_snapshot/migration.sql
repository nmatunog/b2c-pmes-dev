-- Raw B2C registry / sheet columns preserved on legacy import
ALTER TABLE "Participant" ADD COLUMN "registryImportSnapshot" JSONB;

ALTER TABLE public.businesses
    ADD COLUMN "widgetKey" TEXT,
    ADD COLUMN "allowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "businesses_widgetKey_key"
    ON public.businesses ("widgetKey");

CREATE TABLE public.widget_rate_buckets (
    "businessId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_rate_buckets_pkey"
        PRIMARY KEY ("businessId"),

    CONSTRAINT "widget_rate_buckets_businessId_fkey"
        FOREIGN KEY ("businessId")
        REFERENCES public.businesses(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
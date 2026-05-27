-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "account" VARCHAR(20) NOT NULL,
    "customer" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "surveye_code" VARCHAR(20) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "is_alive" BOOLEAN NOT NULL DEFAULT false,
    "is_alarms_snoozed" BOOLEAN NOT NULL DEFAULT false,
    "alarms_snoozed_by" INTEGER,
    "is_alive_snoozed" BOOLEAN NOT NULL DEFAULT false,
    "alive_snoozed_by" INTEGER,
    "tested_by" INTEGER,
    "tested_at" TIMESTAMP(3),
    "freezed_by" INTEGER,
    "freezed_at" TIMESTAMP(3),
    "subscription" INTEGER NOT NULL DEFAULT 1,
    "subscription_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarms" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "code" VARCHAR(10),
    "detail" VARCHAR(150),
    "sia_raw_message" TEXT,
    "mail_sent" BOOLEAN NOT NULL DEFAULT false,
    "managed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alarms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sia_messages" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "message_type" VARCHAR(20),
    "sia_raw_message" TEXT,
    "acked" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sia_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keep_alives" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(20) NOT NULL,
    "sia_raw_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keep_alives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sia_codes" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "description" VARCHAR(200) NOT NULL,

    CONSTRAINT "sia_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "description" VARCHAR(100) NOT NULL,
    "days_duration" INTEGER NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abboattivi" (
    "destinazione" VARCHAR(20) NOT NULL,
    "scadenza" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abboattivi_pkey" PRIMARY KEY ("destinazione")
);

-- CreateTable
CREATE TABLE "statistics" (
    "id" SERIAL NOT NULL,
    "keep_alives" BIGINT NOT NULL DEFAULT 0,
    "alarms" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_account_key" ON "customers"("account");

-- CreateIndex
CREATE UNIQUE INDEX "keep_alives_customer_id_key" ON "keep_alives"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "sia_codes_code_key" ON "sia_codes"("code");

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("account") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sia_messages" ADD CONSTRAINT "sia_messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("account") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keep_alives" ADD CONSTRAINT "keep_alives_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("account") ON DELETE RESTRICT ON UPDATE CASCADE;

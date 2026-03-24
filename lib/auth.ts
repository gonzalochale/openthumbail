import { betterAuth } from "better-auth";
import { pool } from "@/lib/db";
import Stripe from "stripe";

export const auth = betterAuth({
  database: pool,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      credits: {
        type: "number",
        required: false,
        defaultValue: 1,
        input: false,
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
        returned: false, // never expose Stripe customer ID to the client
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          void (async () => {
            try {
              const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
              const customer = await stripe.customers.create({
                email: user.email,
                name: user.name ?? undefined,
                metadata: { userId: user.id },
              });
              await pool.query(
                `UPDATE "user" SET stripe_customer_id = $1 WHERE id = $2`,
                [customer.id, user.id],
              );
            } catch (err) {
              console.error("Failed to create Stripe customer:", err);
            }
          })();
        },
      },
    },
  },
});

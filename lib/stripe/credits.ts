import { pool } from "@/lib/db";

export async function deductCredit(userId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ credits: number }>(
      `SELECT credits FROM "user" WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    if ((result.rows[0]?.credits ?? 0) < 1) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `UPDATE "user" SET credits = credits - 1 WHERE id = $1`,
      [userId],
    );
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function refundCredit(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT credits FROM "user" WHERE id = $1 FOR UPDATE`, [
      userId,
    ]);
    await client.query(
      `UPDATE "user" SET credits = credits + 1 WHERE id = $1`,
      [userId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getCredits(userId: string): Promise<number> {
  const result = await pool.query<{ credits: number }>(
    `SELECT credits FROM "user" WHERE id = $1`,
    [userId],
  );
  return result.rows[0]?.credits ?? 0;
}

export async function grantKonamiCredits(
  userId: string,
  email: string,
): Promise<{ newBalance: number; alreadyRedeemed: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insert = await client.query(
      `INSERT INTO konami_redemption (user_id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
      [userId, email],
    );
    if ((insert.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return { newBalance: 0, alreadyRedeemed: true };
    }
    const result = await client.query<{ credits: number }>(
      `UPDATE "user" SET credits = credits + 3 WHERE id = $1 RETURNING credits`,
      [userId],
    );
    await client.query("COMMIT");
    return { newBalance: result.rows[0]?.credits ?? 0, alreadyRedeemed: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function grantCredits(
  userId: string,
  stripeSessionId: string,
  creditsToAdd: number,
  amountCents: number,
): Promise<number | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insert = await client.query(
      `INSERT INTO credit_purchase (user_id, stripe_session_id, credits_added, amount_cents)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (stripe_session_id) DO NOTHING`,
      [userId, stripeSessionId, creditsToAdd, amountCents],
    );
    if ((insert.rowCount ?? 0) === 0) {
      await client.query("COMMIT");
      return null; // already processed
    }
    const result = await client.query<{ credits: number }>(
      `UPDATE "user" SET credits = credits + $1 WHERE id = $2 RETURNING credits`,
      [creditsToAdd, userId],
    );
    await client.query("COMMIT");
    return result.rows[0]?.credits ?? 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

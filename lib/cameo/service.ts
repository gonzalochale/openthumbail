import { pool } from "@/lib/db";
import {
  cameoKey,
  deleteObject,
  getObjectBase64,
  uploadImage,
} from "@/lib/storage/s3";

export interface CameoRecord {
  userId: string;
  imageKey: string;
}

export async function getCameo(userId: string): Promise<CameoRecord | null> {
  const res = await pool.query<{ image_key: string }>(
    `SELECT image_key FROM user_cameo WHERE user_id = $1`,
    [userId],
  );
  if (res.rows.length === 0) return null;
  return { userId, imageKey: res.rows[0].image_key };
}

export async function hasCameo(userId: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM user_cameo WHERE user_id = $1`,
    [userId],
  );
  return res.rows.length > 0;
}

export async function saveCameo(
  userId: string,
  imageBase64: string,
): Promise<void> {
  const key = cameoKey(userId);
  await uploadImage(key, imageBase64, "image/jpeg");
  await pool.query(
    `INSERT INTO user_cameo (user_id, image_key)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET image_key = EXCLUDED.image_key,
           updated_at = now()`,
    [userId, key],
  );
}

export async function deleteCameo(userId: string): Promise<void> {
  const record = await getCameo(userId);
  if (!record) return;
  await deleteObject(record.imageKey);
  await pool.query(`DELETE FROM user_cameo WHERE user_id = $1`, [userId]);
}

export async function getCameoImages(
  userId: string,
): Promise<{ imageBase64: string; mimeType: string }[] | null> {
  const record = await getCameo(userId);
  if (!record) return null;
  const imageBase64 = await getObjectBase64(record.imageKey);
  return [{ imageBase64, mimeType: "image/jpeg" }];
}

export function validateImage(imageBase64: string): string | null {
  if (!imageBase64 || typeof imageBase64 !== "string")
    return "Image data required";
  if (imageBase64.length < 1000) return "Image appears empty";
  if (imageBase64.length > 2_000_000) return "Image exceeds size limit";
  return null;
}

export interface PoseAngles {
  pitch: number;
  yaw: number;
  roll: number;
}

export function getPoseAngles(matrix: Float32Array): PoseAngles {
  const yaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI);
  const pitch =
    Math.atan2(-matrix[9], Math.sqrt(matrix[8] ** 2 + matrix[10] ** 2)) *
    (180 / Math.PI);
  const roll = Math.atan2(matrix[1], matrix[5]) * (180 / Math.PI);
  return { pitch, yaw, roll };
}

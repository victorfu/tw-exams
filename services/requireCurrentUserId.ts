/** 不需登入、大家共用：所有資料都掛在同一個公開使用者底下。 */
export const PUBLIC_USER_ID = "public";

export function requireCurrentUserId(): string {
  return PUBLIC_USER_ID;
}

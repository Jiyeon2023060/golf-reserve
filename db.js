import { createClient } from "@libsql/client";

// 환경변수에 줄바꿈/공백이 섞여 들어오는 경우가 있어 정리한다.
const url = process.env.TURSO_URL?.trim();
const authToken = process.env.TURSO_TOKEN?.trim();

if (!url) {
  throw new Error("TURSO_URL 환경변수가 설정되지 않았습니다.");
}

export const db = createClient({ url, authToken });

// 앱 시작 시 테이블 생성 (없을 때만)
export async function initSchema() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club TEXT NOT NULL,                         -- 골프장
        course TEXT NOT NULL,                       -- 코스
        play_date TEXT NOT NULL,                    -- 라운딩 날짜 (YYYY-MM-DD)
        play_time TEXT NOT NULL,                    -- 라운딩 시간 (HH:MM)
        selected INTEGER NOT NULL DEFAULT 1,        -- 체크박스 (1: 선택됨)
        status TEXT NOT NULL DEFAULT '대기',         -- 대기 / 예약완료
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_res_created ON reservations(created_at DESC)`,
    ],
    "write"
  );
}

import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, initSchema } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN = process.env.ADMIN || "";
const PW = process.env.PW || "";
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(SESSION_SECRET));

if (!ADMIN || !PW) {
  console.warn(
    "[경고] ADMIN / PW 가 설정되지 않았습니다. 인증 없이 접근 가능합니다."
  );
}

// ---- 인증 ----
const COOKIE = "golf_auth";
const authRequired = Boolean(ADMIN && PW);

function makeToken() {
  // 아이디+비밀번호 기반 서명 토큰. 값이 바뀌면 기존 토큰은 무효화됨.
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update("authed:" + ADMIN + ":" + PW)
    .digest("hex");
}

function isAuthed(req) {
  if (!authRequired) return true;
  return req.signedCookies[COOKIE] === makeToken();
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!authRequired || (username === ADMIN && password === PW)) {
    res.cookie(COOKIE, makeToken(), {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  res.json({ authed: isAuthed(req), authRequired });
});

// ---- 예약 API ----

// 목록 (최근 추가 순)
app.get("/api/reservations", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.execute(
      "SELECT * FROM reservations ORDER BY id DESC"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// 추가 (예약 항목을 리스트에 담기 — 상태: 대기)
app.post("/api/reservations", requireAuth, async (req, res, next) => {
  try {
    const { club, course, play_date, play_time } = req.body || {};
    if (!club || !course || !play_date || !play_time) {
      return res
        .status(400)
        .json({ error: "골프장·코스·날짜·시간을 모두 선택하세요." });
    }
    const r = await db.execute({
      sql: `INSERT INTO reservations (club, course, play_date, play_time)
            VALUES (?, ?, ?, ?)`,
      args: [club, course, play_date, play_time],
    });
    const { rows } = await db.execute({
      sql: "SELECT * FROM reservations WHERE id = ?",
      args: [Number(r.lastInsertRowid)],
    });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// 체크박스 토글
app.patch("/api/reservations/:id/check", requireAuth, async (req, res, next) => {
  try {
    const selected = req.body?.selected ? 1 : 0;
    await db.execute({
      sql: "UPDATE reservations SET selected = ? WHERE id = ?",
      args: [selected, req.params.id],
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// 한 건 삭제
app.delete("/api/reservations/:id", requireAuth, async (req, res, next) => {
  try {
    await db.execute({
      sql: "DELETE FROM reservations WHERE id = ?",
      args: [req.params.id],
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// 예약 실행 — 체크된 '대기' 항목들을 '예약완료'로 바꾼다.
app.post("/api/reservations/submit", requireAuth, async (req, res, next) => {
  try {
    const r = await db.execute(
      "UPDATE reservations SET status = '예약완료' WHERE selected = 1 AND status = '대기'"
    );
    res.json({ ok: true, count: r.rowsAffected });
  } catch (e) {
    next(e);
  }
});

// ---- 정적 파일 ----
app.use(express.static(path.join(__dirname, "public")));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .json({ error: "서버 오류", detail: String(err?.message || err) });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`골프장 예약 서버 실행 중: http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error("DB 초기화 실패:", e);
    process.exit(1);
  });

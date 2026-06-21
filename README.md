# ⛳ 골프장 예약 자동 실행 시스템

골프장·코스·날짜·시간을 골라 예약 리스트에 담고, 지정한 **예약 시작 시각(시·분·초)** 이 되면
체크된 예약들이 자동으로 제출(확정)되는 웹 앱입니다.

## 기능

- 로그인 (관리자 아이디/비밀번호)
- 골프장 선택(드롭다운) → 코스 선택(드롭다운) → 날짜 → 시간
- `추가` 버튼: 예약 리스트에 항목 담기 / `삭제` 버튼: 입력칸 초기화
- 예약 리스트(체크박스, 상태 표시, 행 삭제)
- 예약 시작 시각(시·분·초) 입력 + 현재 시각 실시간 표시
- `예약 시작` 버튼: 지정 시각이 되면 체크된 예약을 자동 제출

## 기술 스택

- Node.js + Express
- Turso (libSQL) 데이터베이스
- 정적 프론트엔드 (HTML/CSS/JS)
- Render Blueprint(`render.yaml`) 로 배포

## 로컬 실행

```bash
npm install
npm start
# http://localhost:3000  (로그인: ADMIN / PW 값)
```

`.env` 파일에 아래 값이 필요합니다 (`.env.example` 참고).

| Key | 설명 |
| --- | --- |
| `TURSO_URL` | Turso DB 주소 |
| `TURSO_TOKEN` | Turso 인증 토큰 |
| `ADMIN` | 로그인 아이디 |
| `PW` | 로그인 비밀번호 |
| `SESSION_SECRET` | 쿠키 서명용 (로컬은 임의 문자열) |

## 배포 (Render Blueprint)

1. Turso 에서 DB 생성 → `TURSO_URL`, `TURSO_TOKEN` 확보
2. 이 프로젝트를 GitHub 에 push (`.env` 제외)
3. Render → New + → Blueprint → 저장소 연결
4. 환경변수 `TURSO_URL` / `TURSO_TOKEN` / `ADMIN` / `PW` 입력
5. Deploy Blueprint

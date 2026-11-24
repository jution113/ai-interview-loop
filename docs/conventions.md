# Git 컨벤션

## 1. 기본 원칙

- `main`은 검증을 마친 `dev`를 병합하는 기본 브랜치로 유지한다.
- `dev`는 작업 브랜치를 병합하고 통합 검증을 수행하는 브랜치로 유지한다.
- 로드맵의 검증 가능한 작업 하나를 기준으로 브랜치와 PR을 구성한다.
- 민감정보, 실제 지원 자료, API 키, 생성물을 커밋하지 않는다. 필요한 설정 예시는 비밀값 없이 제공한다.

## 2. 브랜치

형식: `<type>/<short-description>` (영문 소문자, kebab-case)

| 유형 | 용도 | 예시 |
| --- | --- | --- |
| feat | 기능 추가 | feat/interview-session |
| fix | 버그 수정 | fix/question-retry |
| refactor | 동작 변경 없는 구조 개선 | refactor/session-service |
| test | 테스트 추가·개선 | test/session-state |
| docs | 문서 변경 | docs/verification-guide |
| chore | 설정·빌드·유지보수 | chore/ci-setup |

새 작업 브랜치는 최신 `dev`를 기준으로 분기한다. 관련 없는 변경은 별도 브랜치로 분리한다. 기존 작업이 있다면 덮어쓰지 않는다.

## 3. 커밋

Conventional Commits 형태를 사용한다.

```text
<type>(<scope>): <description>
```

scope는 선택 사항이다. 제목은 변경의 목적을 간결히 설명하고, 필요한 경우 본문에 이유와 영향을 기록한다.

- `feat(backend): 면접 세션 저장 기능 추가`
- `fix(frontend): 타이머 종료 시 중복 제출 방지`
- `test(backend): 질문 재시도 한도 검증`
- `docs: 검증 절차 추가`

유형은 브랜치 표와 동일하게 사용하며, 필요하면 ci, build, perf를 추가한다. 하나의 커밋은 논리적으로 일관된 변경을 담는다. 기능과 그 기능을 검증하는 테스트는 같은 커밋에 포함해도 된다.

## 4. Pull Request

- 제목은 커밋 제목과 동일한 형식을 권장한다.
- 기존 `.github/pull_request_template.md`를 사용한다.
- 목적, 변경 범위, 관련 로드맵·ADR·이슈(존재할 때), 검증 결과, 미검증 사항을 기록한다.
- AI가 작성한 테스트 및 리뷰 결과와 개발자가 직접 확인한 결과를 구분한다.
- 작업 PR의 대상은 `dev`로, 통합 검증을 마친 `dev`의 PR 대상은 `main`으로 설정한다.
- 필수 테스트와 개발자 검토가 완료된 후 병합한다. 실패한 필수 검증을 숨기지 않는다.

## 5. 병합

- 작업 브랜치를 `dev`에 병합할 때는 squash merge를 기본으로 권장한다.
- 통합 검증을 마친 `dev`를 `main`에 반영할 때는 merge commit으로 병합 이력을 연결한다.
- CI를 구축한 이후에는 필수 검사 통과를 병합 조건으로 설정한다.
- 병합 후 불필요한 작업 브랜치를 삭제하고 로드맵 상태를 갱신한다. `dev`는 다음 작업의 기준 브랜치로 유지한다.
- AI는 명시적 승인 없이 원격 push, PR 생성, 병합, 강제 push 또는 이력 변경을 수행하지 않는다.

관련 문서: [검증 가이드](validation/validation-guide.md), [AGENTS.md](../AGENTS.md).

import assert from "node:assert/strict";
import test from "node:test";
import { taskSubtitle, groupTasksBySubtitle } from "../src/lib/task-groups.ts";

test("번호 대신 소제목으로 분류하고 공백과 강조 표시를 정리한다", () => {
  assert.equal(taskSubtitle("[KT-001][기획] 베타 범위 확정"), "기획");
  assert.equal(taskSubtitle("  [CO-021] [개인정보] 정책 검토"), "개인정보");
  assert.equal(taskSubtitle("[007][**추가개발**] 개선"), "추가개발");
  assert.equal(taskSubtitle("[검수] 기준 확정"), "검수");
});

test("분류가 없는 태스크도 누락하지 않는다", () => {
  assert.equal(taskSubtitle("[KT-001] 번호만 있는 제목"), "미분류");
  assert.equal(taskSubtitle("본문 중 [기획] 표시"), "미분류");
  assert.equal(taskSubtitle(""), "미분류");
});

test("그룹과 그룹 안의 태스크는 기존 순서를 유지하고 원본을 수정하지 않는다", () => {
  const tasks = [{ id: 1, title: "[KT-001][기획] 첫 작업" }, { id: 2, title: "[KT-002][검수] 검수" }, { id: 3, title: "[KT-003][기획] 후속 작업" }, { id: 4, title: "분류 없음" }];
  const before = structuredClone(tasks);
  const groups = groupTasksBySubtitle(tasks);
  assert.deepEqual(groups.map((g) => g.subtitle), ["기획", "검수", "미분류"]);
  assert.deepEqual(groups[0].tasks.map((t) => t.id), [1, 3]);
  assert.equal(groups.flatMap((g) => g.tasks).length, tasks.length);
  assert.deepEqual(tasks, before);
  assert.deepEqual(groupTasksBySubtitle([]), []);
});

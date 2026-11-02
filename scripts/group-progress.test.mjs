import assert from "node:assert/strict";
import test from "node:test";
import { groupProgress } from "../src/lib/group-progress.ts";

const T = (id, status, parentId = null, dueDate = null) => ({ id, status, parentId, dueDate });

test("완료는 1, 미완료 상위 태스크는 서브태스크 완료 비율만큼 반영한다", () => {
  const tops = [T("a", "done"), T("b", "in_progress"), T("c", "todo")];
  const all = [...tops, T("b1", "done", "b"), T("b2", "todo", "b")];
  const p = groupProgress(tops, all, "2026-11-02");
  assert.equal(p.percent, 50); // (1 + 0.5 + 0) / 3
  assert.deepEqual(p.counts, { todo: 1, in_progress: 1, review: 0, done: 1 });
  assert.equal(p.done, 1);
});

test("지연은 상위·서브태스크 모두 세고, 완료된 것은 제외한다", () => {
  const tops = [T("a", "todo", null, "2026-10-01"), T("b", "done", null, "2026-10-01")];
  const all = [...tops, T("a1", "review", "a", "2026-10-30"), T("a2", "todo", "a", "2026-12-01")];
  assert.equal(groupProgress(tops, all, "2026-11-02").overdue, 2);
});

test("빈 묶음은 0%", () => {
  assert.equal(groupProgress([], [], "2026-11-02").percent, 0);
});

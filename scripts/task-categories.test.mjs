import assert from "node:assert/strict";
import test from "node:test";
import { groupTasksByCategory } from "../src/lib/task-groups.ts";

const tasks = [
  { id: 1, title: "[설립] 정관" }, { id: 2, title: "[회계] 장부" }, { id: 3, title: "[출자] 납입" },
  { id: 4, title: "[설립] 등기" }, { id: 5, title: "[신규] 미지정 소제목" }, { id: 6, title: "분류 없음" },
];
const cats = [{ name: "착수·설립", subtitles: ["설립", "출자"] }, { name: "재무", subtitles: ["회계"] }, { name: "빈 묶음", subtitles: ["없는소제목"] }];

test("대분류 순서로 묶고, 묶음 안에서는 소제목끼리 모은다", () => {
  const g = groupTasksByCategory(tasks, cats);
  assert.deepEqual(g.map((x) => x.label), ["착수·설립", "재무", "기타 (대분류 미지정)"]);
  assert.deepEqual(g[0].tasks.map((t) => t.id), [1, 4, 3]);
  assert.deepEqual(g[0].subtitles, ["설립", "출자"]);
});

test("미지정 소제목과 미분류는 기타로, 태스크는 하나도 빠지지 않는다", () => {
  const g = groupTasksByCategory(tasks, cats);
  assert.deepEqual(g.at(-1).tasks.map((t) => t.id), [5, 6]);
  assert.equal(g.flatMap((x) => x.tasks).length, tasks.length);
  assert.deepEqual(groupTasksByCategory(tasks, []).map((x) => x.label), ["기타 (대분류 미지정)"]);
});

test("같은 소제목이 두 대분류에 있으면 앞의 대분류만 쓴다", () => {
  const g = groupTasksByCategory(tasks, [{ name: "A", subtitles: ["회계"] }, { name: "B", subtitles: ["회계", "설립"] }]);
  assert.deepEqual(g.find((x) => x.label === "A").tasks.map((t) => t.id), [2]);
  assert.deepEqual(g.find((x) => x.label === "B").subtitles, ["설립"]);
});

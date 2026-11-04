import test from "node:test";
import assert from "node:assert/strict";
import { canModifyPost, noticeContent } from "../src/lib/notice-policy.ts";
test("공지는 작성자라도 현재 관리자가 아니면 수정·삭제할 수 없다",()=>{
 for(const role of ["viewer","editor"])assert.equal(canModifyPost({id:"author",role},{userId:"author",isNotice:true}),false);
 assert.equal(canModifyPost({id:"admin",role:"admin"},{userId:"author",isNotice:true}),true);
});
test("일반 의견의 기존 작성자·관리자 권한을 유지한다",()=>{
 assert.equal(canModifyPost({id:"author",role:"viewer"},{userId:"author",isNotice:false}),true);
 assert.equal(canModifyPost({id:"other",role:"editor"},{userId:"author",isNotice:false}),false);
 assert.equal(canModifyPost({id:"admin",role:"admin"},{userId:null,isNotice:false}),true);
});
test("빈 공지와 초과 입력은 차단하고 줄바꿈·한글은 보존한다",()=>{
 assert.throws(()=>noticeContent(" \n "),/입력/);
 assert.throws(()=>noticeContent("가".repeat(5001)),/5,000/);
 assert.equal(noticeContent("  일정 공유\n금요일까지 확인해 주세요.  "),"일정 공유\n금요일까지 확인해 주세요.");
 assert.equal(noticeContent("가".repeat(5000)).length,5000);
});

// 下一个可申请的备案号（公开接口，供申请表单预览用）。
// GET /api/next -> { seq, icp_number, start, reserved_max }
// 用户申请从 101 号开始；1-100 号为管理员预留号，不在这里分配。
const PREFIX = "涅ICP备";
const USER_START = 101;
const RESERVED_MAX = 100;
const parseSeq = (icp) => {
  const m = /^涅ICP备\d{4}(\d{5})号$/.exec(String(icp || ""));
  return m ? parseInt(m[1], 10) : null;
};

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT icp_number FROM filings").all();
  let max = 0;
  for (const r of results || []) {
    const s = parseSeq(r.icp_number);
    if (s !== null && s > max) max = s;
  }
  const seq = Math.max(USER_START, max + 1);
  const year = new Date().getFullYear();
  return Response.json({
    seq,
    icp_number: `${PREFIX}${year}${String(seq).padStart(5, "0")}号`,
    start: USER_START,
    reserved_max: RESERVED_MAX,
  });
}

// util.js：计划与执行共用的口径
export function moveKey(move) {
  return move[0] + "->" + move[1];
}

export function makeError(code, message) {
  const error = new Error(code + " " + message);
  error.code = code;
  return error;
}

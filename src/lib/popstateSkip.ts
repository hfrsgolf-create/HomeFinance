// Allows Modal cleanup to call history.back() without the App-level
// popstate handler treating it as real navigation and popping the back stack.
let skipCount = 0;
export function skipNextPopstate() { skipCount++; }
export function consumeSkipPopstate(): boolean {
  if (skipCount > 0) { skipCount--; return true; }
  return false;
}

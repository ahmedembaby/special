'use strict';
// True when the message text @-mentions the username (case-insensitive, whole handle).
function mentionsUser(content, username) {
  if (!content || !username) return false;
  const esc = String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w])@${esc}(?![\\w])`, 'i').test(String(content));
}
module.exports = { mentionsUser };

const path = require('path');

// Authorizes /uploads/chat and /uploads/stories. The token comes from ?t= (a media-only token from new apps, or the session JWT
// from older apps, both accepted) or from the Authorization header. Resource-level access is still checked per file.
function makePrivateUploadAuth({ authenticateToken, authenticateMediaToken, getToken, canAccessChatMedia, canAccessStoryMedia, uploadsDir }) {
  return (kind) => async (req, res, next) => {
    try {
      const raw = req.query.t || getToken(req);
      const user = (await authenticateMediaToken(raw)) || (await authenticateToken(raw));
      if (!user) return res.status(401).end();
      const filename = path.basename(req.path);
      if (!filename || filename !== req.path.slice(1)) return res.status(404).end();
      const allowed = kind === 'chat'
        ? await canAccessChatMedia(filename, user.id)
        : await canAccessStoryMedia(filename, user.id);
      if (!allowed) return res.status(404).end();
      // Serve private assets directly so the public static middleware cannot replace
      // the no-store policy with a cacheable response.
      return res.sendFile(path.join(uploadsDir, kind, filename), {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cross-Origin-Resource-Policy': 'same-site',
        },
      }, (err) => {
        if (err && !res.headersSent) res.status(404).end();
      });
    } catch {
      res.status(404).end();
    }
  };
}

module.exports = { makePrivateUploadAuth };

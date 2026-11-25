"""Cache-Control values shared by the routers."""

# An import never changes, so its import-scoped responses are cached immutably (AD-3, AD-14).
IMMUTABLE = "private, max-age=31536000, immutable"

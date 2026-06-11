SECURE SETUP FOR 4LIFETAGS NETLIFY + SHOPIFY

Important security rules
1. Never put Shopify Admin API tokens in index.html.
2. Never commit .env files to GitHub.
3. Store all tokens only in Netlify Environment Variables.
4. Give the Shopify custom app only the permissions it needs.
5. Lock the functions to your real website domain with ALLOWED_ORIGINS.
6. Replace tokens immediately if you ever accidentally paste them into public code.

Netlify environment variables required
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_storefront_token
SHOPIFY_ADMIN_ACCESS_TOKEN=your_admin_token

ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,https://your-custom-domain.com

SHOPIFY_VARIANT_TINY=gid://shopify/ProductVariant/...
SHOPIFY_VARIANT_SMALL=gid://shopify/ProductVariant/...
SHOPIFY_VARIANT_MEDIUM=gid://shopify/ProductVariant/...
SHOPIFY_VARIANT_LARGE=gid://shopify/ProductVariant/...

SHOPIFY_ADDON_GIFT_PACKAGING=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_HANDWRITTEN_NOTE=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_RUSH_JOB=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_EXTRA_REMOTE=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_DESIGN_PROOF=gid://shopify/ProductVariant/...

Recommended limits
MAX_UPLOAD_MB=10
MAX_LIGHTBOXES_PER_ORDER=10
MAX_QTY_PER_LIGHTBOX=25
UPLOAD_RATE_LIMIT_PER_MINUTE=10
CHECKOUT_RATE_LIMIT_PER_MINUTE=20
MAX_CHECKOUT_BODY_CHARS=50000

What is protected
- Admin API token is only used inside Netlify Functions.
- Storefront API token is also kept server-side.
- Requests are blocked if they do not come from ALLOWED_ORIGINS.
- Uploads are limited to PNG, JPG, WEBP, or SVG.
- Upload size is limited.
- Checkout payload size is limited.
- Lightbox quantity is capped.
- Number of lightboxes per order is capped.
- Add-ons are whitelisted.
- Sizes are whitelisted.
- Inputs are cleaned and trimmed.
- Security headers are included in netlify.toml.

If a token leaks
1. Delete or rotate the Shopify custom app token.
2. Create a new token/app.
3. Replace the token in Netlify Environment Variables.
4. Trigger a new Netlify deploy.
5. Review Shopify Admin activity and recent orders.

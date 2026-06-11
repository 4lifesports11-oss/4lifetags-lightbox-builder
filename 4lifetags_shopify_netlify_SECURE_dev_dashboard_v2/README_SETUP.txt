4LifeTags Shopify + Netlify Starter

What this does
- Hosts the builder on Netlify.
- Uploads customer logo files to Shopify Files through a Netlify Function.
- Creates a Shopify cart through a Netlify Function.
- Redirects the customer to Shopify checkout.
- Saves all builder details as Shopify cart line attributes so they show on the Shopify order.

Required Shopify setup
1. Create a Shopify product called Custom Lightbox.
2. Add variants:
   - Tiny (5in) $25
   - Small (7in) $30
   - Medium (9in) $35
   - Large (11in) $40
3. Create add-on products/variants:
   - Gift Packaging $6
   - Perfect Gift Add-On $4
   - Rush Job $10
   - Extra Remote $8
   - Design Proof Approval $3
4. Copy the ProductVariant GIDs for each variant.

Required Netlify environment variables
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_storefront_api_token
SHOPIFY_ADMIN_ACCESS_TOKEN=your_admin_api_token_with_write_files
SHOPIFY_VARIANT_TINY=gid://shopify/ProductVariant/...
SHOPIFY_VARIANT_SMALL=gid://shopify/ProductVariant/...
SHOPIFY_VARIANT_MEDIUM=gid://shopify/ProductVariant/...
SHOPIFY_VARIANT_LARGE=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_GIFT_PACKAGING=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_HANDWRITTEN_NOTE=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_RUSH_JOB=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_EXTRA_REMOTE=gid://shopify/ProductVariant/...
SHOPIFY_ADDON_DESIGN_PROOF=gid://shopify/ProductVariant/...
MAX_UPLOAD_MB=10

Important
- Do not put the Admin API token in the HTML.
- The Admin API token must stay in Netlify environment variables only.
- The official Shop Pay accelerated button can only be rendered by Shopify inside Shopify checkout/theme. This page uses your visual Shop button and then redirects to Shopify checkout.

SHOPIFY DEV DASHBOARD UPDATE

This version works with Shopify's newer Dev Dashboard app credentials.

Use these Netlify environment variables from your Dev Dashboard app settings:
SHOPIFY_CLIENT_ID=your Client ID
SHOPIFY_CLIENT_SECRET=your Secret

Do not paste either value into GitHub or index.html.
Mark SHOPIFY_CLIENT_SECRET as secret in Netlify.

This version still needs:
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your Storefront API private token
ALLOWED_ORIGINS=https://4lifelightboxbuilder.netlify.app

For the Shopify Storefront token, the easiest path is:
Shopify Admin -> Sales channels -> Headless -> Create storefront -> copy private Storefront API access token.

STOREFRONT TOKEN FIX

The previous create-checkout function used the public Storefront token header:
X-Shopify-Storefront-Access-Token

The token copied from Shopify Headless is usually a private Storefront API token.
Private Storefront API tokens must be sent with:
Shopify-Storefront-Private-Token

This version defaults to private token mode.

Add this Netlify environment variable:
SHOPIFY_STOREFRONT_TOKEN_TYPE=private

If you later use a public Storefront token instead, set:
SHOPIFY_STOREFRONT_TOKEN_TYPE=public

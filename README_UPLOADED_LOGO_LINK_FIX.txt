UPLOADED LOGO ORDER LINK FIX

This version improves uploaded-logo visibility inside Shopify orders.

What changed:
- The upload function now waits for Shopify Files to finish processing the uploaded image.
- The checkout function adds clearer line item attributes:
  Uploaded Logo Image URL
  Open Uploaded Logo
  Shopify Upload File ID
  Uploaded Logo Filename

Important:
Shopify's standard order page usually does not render custom line item image URLs as embedded thumbnails.
It will show the URL/value in the line item details so you can click or copy it to view the uploaded logo.

If you need true embedded image previews directly inside the Shopify admin order screen, that requires a custom Shopify admin app/extension or a separate fulfillment dashboard.

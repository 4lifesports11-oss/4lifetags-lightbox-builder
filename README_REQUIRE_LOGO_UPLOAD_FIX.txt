REQUIRE LOGO UPLOAD FIX

This version prevents checkout if the customer selected Upload a Logo but the upload did not successfully finish.

Why:
Previously, if a Shopify upload failed or was still processing, the order could still go through with only the filename.
That caused Shopify orders to say:
Uploaded Logo Image URL: None
Shopify Upload File ID: None

What changed:
- Frontend now blocks checkout until uploadFileUrl or uploadFileId exists.
- Frontend shows an alert if upload fails.
- Backend rejects checkout if an Upload a Logo order has only a filename and no uploaded Shopify file link/id.

After deploying this:
1. Choose Upload a Logo.
2. Pick a file.
3. Wait for the success message below the upload field.
4. Then checkout.

If upload fails, check Netlify Function logs for upload-logo.

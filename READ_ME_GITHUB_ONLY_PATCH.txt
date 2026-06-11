GITHUB ONLY PATCH

Use this when the Netlify deploy is connected to GitHub and the full ZIP failed.

Upload ONLY these files to the root of the GitHub repo:
- index.html
- VERIFY_DEPLOY.html

Do NOT upload:
- package.json
- netlify.toml
- netlify/functions
- assets folder

Why:
This patch only changes the visual builder page. It leaves the existing Netlify build settings and functions alone, so the deploy is less likely to fail.

After GitHub deploy finishes, test:
https://YOUR-BUILDER-PROJECT.netlify.app/VERIFY_DEPLOY.html

It should say:
STANDALONE BUILDER IMAGE FIX IS LIVE

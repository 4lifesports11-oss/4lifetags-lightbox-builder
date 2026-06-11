const Busboy = require("busboy");

const SHOPIFY_API_VERSION = "2026-04";
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.UPLOAD_RATE_LIMIT_PER_MINUTE || "10");
const rateBucket = new Map();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    },
    body: JSON.stringify(body)
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Server is missing required configuration: ${name}`);
  return value;
}

function getIp(event) {
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    event.headers["x-forwarded-for"] ||
    "unknown"
  ).split(",")[0].trim();
}

function rateLimit(event) {
  const ip = getIp(event);
  const now = Date.now();
  const record = rateBucket.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  record.count += 1;
  rateBucket.set(ip, record);

  return record.count <= RATE_LIMIT_MAX;
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function checkOrigin(event) {
  const allowed = allowedOrigins();

  if (!allowed.length) {
    throw new Error("Server is missing ALLOWED_ORIGINS.");
  }

  const origin = event.headers.origin || event.headers.Origin || "";
  const referer = event.headers.referer || event.headers.Referer || "";

  return allowed.some((allowedOrigin) => origin === allowedOrigin || referer.startsWith(allowedOrigin + "/"));
}

function safeFilename(filename) {
  return String(filename || "logo-upload")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function isAllowedMime(mimeType) {
  return /^image\/(png|jpe?g|webp|svg\+xml)$/i.test(mimeType || "");
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];

    if (!contentType) {
      reject(new Error("Missing content-type header."));
      return;
    }

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: {
        files: 1,
        fileSize: Number(process.env.MAX_UPLOAD_MB || "10") * 1024 * 1024
      }
    });

    let uploadedFile = null;
    let limitReached = false;

    busboy.on("file", (fieldname, file, info) => {
      const chunks = [];

      file.on("limit", () => {
        limitReached = true;
        file.resume();
      });

      file.on("data", (chunk) => chunks.push(chunk));

      file.on("end", () => {
        if (limitReached) return;

        uploadedFile = {
          fieldname,
          filename: safeFilename(info.filename),
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
    });

    busboy.on("error", reject);

    busboy.on("finish", () => {
      if (limitReached) {
        reject(new Error(`Logo file is too large. Max size is ${process.env.MAX_UPLOAD_MB || "10"}MB.`));
        return;
      }

      if (!uploadedFile) {
        reject(new Error("No file was uploaded."));
        return;
      }

      resolve(uploadedFile);
    });

    const bodyBuffer = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
    busboy.end(bodyBuffer);
  });
}

let cachedAdminToken = null;
let cachedAdminTokenExpiresAt = 0;

async function getAdminAccessToken() {
  // New Shopify Dev Dashboard flow:
  // SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET are stored in Netlify only.
  // The Admin token is requested server-side and refreshed automatically.
  if (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) {
    const now = Date.now();

    if (cachedAdminToken && now < cachedAdminTokenExpiresAt - 5 * 60 * 1000) {
      return cachedAdminToken;
    }

    const storeDomain = requireEnv("SHOPIFY_STORE_DOMAIN").replace(/^https?:\/\//, "");

    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", requireEnv("SHOPIFY_CLIENT_ID"));
    body.set("client_secret", requireEnv("SHOPIFY_CLIENT_SECRET"));

    const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("Shopify token request failed:", JSON.stringify(data, null, 2));
      throw new Error("Shopify Admin access could not be created.");
    }

    cachedAdminToken = data.access_token;
    cachedAdminTokenExpiresAt = Date.now() + Number(data.expires_in || 86399) * 1000;
    return cachedAdminToken;
  }

  // Fallback for older Shopify admin-created custom apps.
  return requireEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
}

async function shopifyAdmin(query, variables) {
  const storeDomain = requireEnv("SHOPIFY_STORE_DOMAIN").replace(/^https?:\/\//, "");
  const token = await getAdminAccessToken();

  const response = await fetch(`https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token
    },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json();

  if (!response.ok || data.errors) {
    console.error("Shopify Admin error:", JSON.stringify(data, null, 2));
    throw new Error("Shopify file upload failed.");
  }

  return data;
}

async function createStagedTarget(file) {
  const mutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyAdmin(mutation, {
    input: [
      {
        filename: file.filename,
        mimeType: file.mimeType,
        httpMethod: "POST",
        resource: "PRODUCT_IMAGE"
      }
    ]
  });

  const payload = data.data.stagedUploadsCreate;

  if (payload.userErrors && payload.userErrors.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join(", "));
  }

  return payload.stagedTargets[0];
}

async function uploadToStagedTarget(target, file) {
  const form = new FormData();

  target.parameters.forEach((param) => {
    form.append(param.name, param.value);
  });

  form.append("file", new Blob([file.buffer], { type: file.mimeType }), file.filename);

  const response = await fetch(target.url, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Staged upload failed:", response.status, text);
    throw new Error("Could not upload file to Shopify storage.");
  }
}

async function createShopifyFile(target, file) {
  const mutation = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          alt
          createdAt
          ... on MediaImage {
            image {
              url
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyAdmin(mutation, {
    files: [
      {
        alt: file.filename,
        contentType: "IMAGE",
        originalSource: target.resourceUrl
      }
    ]
  });

  const payload = data.data.fileCreate;

  if (payload.userErrors && payload.userErrors.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join(", "));
  }

  return payload.files[0];
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    if (!checkOrigin(event)) {
      return json(403, { error: "Request blocked." });
    }

    if (!rateLimit(event)) {
      return json(429, { error: "Too many uploads. Please wait a minute and try again." });
    }

    const file = await parseMultipart(event);

    if (!isAllowedMime(file.mimeType)) {
      return json(400, { error: "Please upload a PNG, JPG, WEBP, or SVG logo file." });
    }

    const target = await createStagedTarget(file);
    await uploadToStagedTarget(target, file);
    const createdFile = await createShopifyFile(target, file);

    return json(200, {
      fileId: createdFile.id,
      status: createdFile.fileStatus,
      url: createdFile.image && createdFile.image.url ? createdFile.image.url : target.resourceUrl,
      filename: file.filename
    });
  } catch (error) {
    console.error(error);
    const safeMessage = String(error.message || "").startsWith("Server is missing") || String(error.message || "").includes("too large")
      ? error.message
      : "Logo upload failed. Please try again.";
    return json(500, { error: safeMessage });
  }
};

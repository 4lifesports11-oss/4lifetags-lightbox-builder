const SHOPIFY_API_VERSION = "2026-04";

const MAX_DESIGNS = Number(process.env.MAX_LIGHTBOXES_PER_ORDER || "10");
const MAX_QTY_PER_DESIGN = Number(process.env.MAX_QTY_PER_LIGHTBOX || "25");
const MAX_BODY_CHARS = Number(process.env.MAX_CHECKOUT_BODY_CHARS || "50000");
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.CHECKOUT_RATE_LIMIT_PER_MINUTE || "20");
const rateBucket = new Map();

const sizeVariantEnv = {
  "Tiny (5in)": "SHOPIFY_VARIANT_TINY",
  "Small (7in)": "SHOPIFY_VARIANT_SMALL",
  "Medium (9in)": "SHOPIFY_VARIANT_MEDIUM",
  "Large (11in)": "SHOPIFY_VARIANT_LARGE"
};

const addonVariantEnv = {
  "Gift Packaging": "SHOPIFY_ADDON_GIFT_PACKAGING",
  "Handwritten Note": "SHOPIFY_ADDON_HANDWRITTEN_NOTE",
  "Rush Job": "SHOPIFY_ADDON_RUSH_JOB",
  "Extra Remote": "SHOPIFY_ADDON_EXTRA_REMOTE",
  "Design Proof Approval": "SHOPIFY_ADDON_DESIGN_PROOF"
};

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

  if (record.count > RATE_LIMIT_MAX) {
    return false;
  }

  return true;
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

  const valid = allowed.some((allowedOrigin) => {
    return origin === allowedOrigin || referer.startsWith(allowedOrigin + "/");
  });

  if (!valid) {
    return false;
  }

  return true;
}

function cleanString(value, maxLength = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function displayAddonName(name) {
  if (name === "Handwritten Note") return "Perfect Gift Add-On";
  return name;
}

function validateDesign(rawDesign) {
  const size = cleanString(rawDesign.size, 50);
  if (!sizeVariantEnv[size]) {
    throw new Error("Invalid lightbox size.");
  }

  const qty = Math.max(1, Math.min(MAX_QTY_PER_DESIGN, Number(rawDesign.qty || 1)));

  const addons = Array.isArray(rawDesign.addons) ? rawDesign.addons : [];
  const safeAddons = addons
    .map((addon) => ({
      name: cleanString(addon.name, 80),
      price: Number(addon.price || 0)
    }))
    .filter((addon) => addonVariantEnv[addon.name]);

  return {
    title: cleanString(rawDesign.title, 120) || "Custom Lightbox",
    selection: cleanString(rawDesign.selection, 80),
    teamText: cleanString(rawDesign.teamText, 120),
    uploadFile: cleanString(rawDesign.uploadFile, 200),
    uploadFileId: cleanString(rawDesign.uploadFileId, 250),
    uploadFileUrl: cleanString(rawDesign.uploadFileUrl, 500),
    logo: cleanString(rawDesign.logo, 500),
    size,
    sizePrice: Number(rawDesign.sizePrice || 0),
    qty,
    request: cleanString(rawDesign.request, 1000),
    note: cleanString(rawDesign.note, 500),
    addons: safeAddons
  };
}

function buildLightboxAttributes(design, index) {
  return [
    { key: "Lightbox Number", value: String(index + 1) },
    { key: "Lightbox Title", value: design.title || "Custom Lightbox" },
    { key: "Selection Option", value: design.selection || "Not selected" },
    { key: "Logo Request / Uploaded File", value: design.logo || design.uploadFileUrl || design.uploadFileId || design.uploadFile || "Not entered" },
    { key: "Uploaded Logo Image URL", value: design.uploadFileUrl || "None" },
    { key: "Open Uploaded Logo", value: design.uploadFileUrl || "No uploaded logo" },
    { key: "Shopify Upload File ID", value: design.uploadFileId || "None" },
    { key: "Uploaded Logo Filename", value: design.uploadFile || "None" },
    { key: "Size", value: design.size },
    { key: "Quantity", value: String(design.qty) },
    { key: "Special Request", value: design.request || "None" },
    { key: "Add-ons", value: design.addons.map((a) => displayAddonName(a.name)).join(", ") || "None" },
    { key: "Gift Note", value: design.note || "None" },
    { key: "Included", value: "1x Lightbox Frame, 1x Pre-Installed LED Lights, 1x Wall Outlet Block, 1x USB Extender, 1x LED Lights Remote" }
  ];
}

function buildAddonAttributes(design, designIndex, addon) {
  return [
    { key: "For Lightbox", value: String(designIndex + 1) },
    { key: "Lightbox Title", value: design.title || "Custom Lightbox" },
    { key: "Add-on", value: displayAddonName(addon.name) }
  ];
}

async function shopifyStorefront(query, variables) {
  const storeDomain = requireEnv("SHOPIFY_STORE_DOMAIN").replace(/^https?:\/\//, "");
  const token = requireEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN");

  const tokenType = String(process.env.SHOPIFY_STOREFRONT_TOKEN_TYPE || "private").toLowerCase();

  const headers = {
    "Content-Type": "application/json"
  };

  if (tokenType === "public") {
    headers["X-Shopify-Storefront-Access-Token"] = token;
  } else {
    headers["Shopify-Storefront-Private-Token"] = token;
  }

  const response = await fetch(`https://${storeDomain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json();

  if (!response.ok || data.errors) {
    console.error("Shopify Storefront error:", JSON.stringify(data, null, 2));
    throw new Error("Shopify checkout could not be created.");
  }

  return data;
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
      return json(429, { error: "Too many requests. Please wait a minute and try again." });
    }

    if (!String(event.headers["content-type"] || "").includes("application/json")) {
      return json(415, { error: "Invalid request type." });
    }

    if ((event.body || "").length > MAX_BODY_CHARS) {
      return json(413, { error: "Request is too large." });
    }

    const body = JSON.parse(event.body || "{}");
    const rawDesigns = Array.isArray(body.designs) ? body.designs : [];

    if (!rawDesigns.length) {
      return json(400, { error: "No lightboxes were submitted." });
    }

    if (rawDesigns.length > MAX_DESIGNS) {
      return json(400, { error: `Too many lightboxes. Maximum is ${MAX_DESIGNS}.` });
    }

    const designs = rawDesigns.map(validateDesign);
    const lines = [];

    designs.forEach((design, index) => {
      const sizeVariantId = requireEnv(sizeVariantEnv[design.size]);

      lines.push({
        merchandiseId: sizeVariantId,
        quantity: design.qty,
        attributes: buildLightboxAttributes(design, index)
      });

      design.addons.forEach((addon) => {
        const addonEnvName = addonVariantEnv[addon.name];
        if (!addonEnvName) return;

        lines.push({
          merchandiseId: requireEnv(addonEnvName),
          quantity: design.qty,
          attributes: buildAddonAttributes(design, index, addon)
        });
      });
    });

    const mutation = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await shopifyStorefront(mutation, {
      input: {
        lines,
        attributes: [
          { key: "Order Builder", value: "4LifeTags Custom Lightbox Builder" },
          { key: "Builder Total Displayed", value: cleanString(body.displayedTotal, 50) }
        ]
      }
    });

    const payload = data.data.cartCreate;

    if (payload.userErrors && payload.userErrors.length) {
      console.error("Cart userErrors:", payload.userErrors);
      return json(400, { error: "Shopify could not create the cart. Please review the order and try again." });
    }

    return json(200, { checkoutUrl: payload.cart.checkoutUrl, cartId: payload.cart.id });
  } catch (error) {
    console.error(error);
    const safeMessage = String(error.message || "").startsWith("Server is missing")
      ? error.message
      : "Checkout failed. Please try again.";
    return json(500, { error: safeMessage });
  }
};

const ENDPOINT =
  "https://serverless.roboflow.com/kashs-workspace/workflows/lab-equipment-recognition";

exports.handler = async (event) => {
  const reply = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Use POST" });
  }

  const key = process.env.ROBOFLOW_API_KEY;
  if (!key) {
    return reply(500, { error: "Server API key is not configured" });
  }

  let image;
  try {
    image = JSON.parse(event.body || "{}").image;
  } catch {
    return reply(400, { error: "Invalid JSON" });
  }

  // Require a raw base64 JPEG, not an arbitrary remote URL.
  if (
    typeof image !== "string" ||
    image.length < 100 ||
    image.length > 1500000 ||
    !image.startsWith("/9j/") ||
    !/^[A-Za-z0-9+/=\r\n]+$/.test(image)
  ) {
    return reply(400, { error: "Send a base64 JPEG under 1.5 MB" });
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        inputs: {
          image: { type: "base64", value: image },
          confidence: 0.4,
          iou_threshold: 0.3,
          class_agnostic_nms: false,
          max_detections: 1000
        }
      })
    });

    if (!response.ok) {
      // Do not forward upstream diagnostics or credentials to the client.
      return reply(response.status === 429 ? 429 : 502, {
        error: `Recognition service returned HTTP ${response.status}`
      });
    }

    const result = await response.json();
    return reply(200, result);
  } catch {
    return reply(502, { error: "Could not reach recognition service" });
  }
};

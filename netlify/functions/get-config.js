export default async (req) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const adminEmail = process.env.ADMIN_EMAIL;

  return new Response(JSON.stringify({ adminEmail }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
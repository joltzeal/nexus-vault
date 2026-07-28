export function GET() {
  return Response.json({
    success: true,
    data: { service: "nexus-vault-api", storage: "postgres" },
    error: null,
  })
}

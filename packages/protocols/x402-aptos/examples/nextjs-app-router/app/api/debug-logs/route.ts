import { type NextRequest, NextResponse } from "next/server";

let logs: string[] = [];

// Internal function - not exported (Next.js route files can only export HTTP methods)
function addLog(message: string) {
  const timestamp = new Date().toISOString();
  logs.push(`[${timestamp}] ${message}`);
  // Keep only last 100 logs
  if (logs.length > 100) {
    logs = logs.slice(-100);
  }
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    logs: logs,
    count: logs.length,
  });
}

export async function DELETE(_request: NextRequest) {
  logs = [];
  return NextResponse.json({ message: "Logs cleared" });
}
